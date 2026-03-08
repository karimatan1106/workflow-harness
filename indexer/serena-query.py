#!/usr/bin/env python3
"""Serena LSP query CLI — generic dispatcher with auto TOON output.

Usage:
    python serena-query.py [--project <path>] <tool_name> [--param value ...]

Examples:
    python serena-query.py find_symbol --name_path_pattern handleError
    python serena-query.py get_symbols_overview --relative_path src/auth.ts
    python serena-query.py find_referencing_symbols --name_path Foo/bar --relative_path src/foo.ts
    python serena-query.py search_for_pattern --substring_pattern "import.*auth" --restrict_search_to_code_files true
    python serena-query.py list_dir --relative_path src --recursive true
    python serena-query.py find_file --file_mask "*.test.ts" --relative_path src

All tool arguments map directly to Serena's apply() parameters.
Output is auto-converted to TOON format.
"""
import json
import sys
import os
import inspect

_agent = None


def get_agent(project_root: str | None = None):
    global _agent
    if _agent is None:
        from serena.agent import SerenaAgent
        from serena.config.serena_config import SerenaConfig
        config = SerenaConfig.from_config_file()
        config.web_dashboard = False
        config.gui_log_window = False
        if project_root and not config.get_registered_project(project_root):
            try:
                config.add_project_from_path(project_root)
                config.save()
            except Exception as e:
                print(f"Warning: auto-register failed: {e}", file=sys.stderr)
        _agent = SerenaAgent(project=project_root, serena_config=config)
    return _agent


def escape_toon(value: str) -> str:
    """Escape value for TOON CSV field."""
    s = str(value)
    if ',' in s or '"' in s or '\\' in s or '\n' in s:
        return '"' + s.replace('"', '""') + '"'
    return s


def flatten_body_location(obj: dict) -> dict:
    """Expand body_location {start_line, end_line} into flat fields."""
    result = {}
    for k, v in obj.items():
        if k == 'body_location' and isinstance(v, dict):
            result['start'] = v.get('start_line', 0)
            result['end'] = v.get('end_line', 0)
        elif isinstance(v, (dict, list)):
            continue  # skip nested structures
        else:
            result[k] = v
    return result


def to_toon(tool_name: str, raw: str) -> str:
    """Auto-convert Serena JSON output to TOON format."""
    if not raw:
        return f"{tool_name}[0]{{}}:\n  (empty)"

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return raw  # plain text, return as-is

    lines = []

    # Pattern 1: list of objects [{...}, {...}]
    if isinstance(data, list):
        rows = [flatten_body_location(item) if isinstance(item, dict) else {'value': item} for item in data]
        if rows:
            fields = list(rows[0].keys())
            lines.append(f"{tool_name}[{len(rows)}]{{{','.join(fields)}}}:")
            for row in rows:
                vals = [escape_toon(row.get(f, '')) for f in fields]
                lines.append(f"  {','.join(vals)}")
        else:
            lines.append(f"{tool_name}[0]{{}}:")
        return '\n'.join(lines)

    if not isinstance(data, dict):
        return str(data)

    # Pattern 2: {files: [...], dirs: [...]} — simple key-array dict
    if all(isinstance(v, list) and all(isinstance(x, str) for x in v) for v in data.values()):
        for key, arr in data.items():
            lines.append(f"{key}[{len(arr)}]{{path}}:")
            for item in arr:
                lines.append(f"  {escape_toon(item)}")
        return '\n'.join(lines)

    # Pattern 3: {file_path: {kind: [refs]}} — find_referencing_symbols
    # or {file_path: [lines]} — search_for_pattern
    rows = []
    for fpath, val in data.items():
        if isinstance(val, dict):
            # {kind: [{name_path, body_location, ...}]}
            for kind, refs in val.items():
                if isinstance(refs, list):
                    for ref in refs:
                        if isinstance(ref, dict):
                            row = flatten_body_location(ref)
                            row['path'] = fpath
                            row['kind'] = kind
                            rows.append(row)
        elif isinstance(val, list):
            # [line_strings] — search results
            for line in val:
                rows.append({'path': fpath, 'match': str(line).strip()})

    if rows:
        fields = list(rows[0].keys())
        lines.append(f"{tool_name}[{len(rows)}]{{{','.join(fields)}}}:")
        for row in rows:
            vals = [escape_toon(str(row.get(f, ''))) for f in fields]
            lines.append(f"  {','.join(vals)}")
    else:
        # Fallback: key=value pairs
        lines.append(f"{tool_name}:")
        for k, v in data.items():
            lines.append(f"  {k}: {v}")

    return '\n'.join(lines)


def coerce_arg(value_str: str, annotation) -> object:
    """Convert CLI string to Python type based on annotation."""
    if annotation is bool or annotation is inspect.Parameter.empty and value_str in ('true', 'false'):
        return value_str.lower() in ('true', '1', 'yes')
    if annotation is int:
        return int(value_str)
    if annotation is float:
        return float(value_str)
    if annotation is list or (hasattr(annotation, '__origin__') and annotation.__origin__ is list):
        return json.loads(value_str) if value_str.startswith('[') else value_str.split(',')
    return value_str


def dispatch(tool_name: str, cli_args: list[str]):
    """Generic dispatcher: resolve tool, parse CLI args, call apply(), output TOON."""
    agent = get_agent()
    # Find tool by class name match
    tool = None
    for t in agent.get_exposed_tool_instances():
        if type(t).__name__ == tool_name:
            tool = t
            break
    if tool is None:
        print(f"Error: tool '{tool_name}' not found.", file=sys.stderr)
        print("Available:", file=sys.stderr)
        for t in agent.get_exposed_tool_instances():
            print(f"  {type(t).__name__}", file=sys.stderr)
        sys.exit(1)

    # Parse apply() signature
    sig = inspect.signature(tool.apply)
    params = {name: p for name, p in sig.parameters.items() if name != 'self'}

    # Parse --key value pairs from CLI
    kwargs = {}
    i = 0
    while i < len(cli_args):
        arg = cli_args[i]
        if arg.startswith('--'):
            key = arg[2:]
            if key in params and i + 1 < len(cli_args):
                ann = params[key].annotation
                kwargs[key] = coerce_arg(cli_args[i + 1], ann)
                i += 2
            else:
                print(f"Warning: unknown param '{key}'", file=sys.stderr)
                i += 2
        else:
            i += 1

    # Fill required positional args that weren't provided as --key
    for name, p in params.items():
        if name not in kwargs and p.default is inspect.Parameter.empty:
            print(f"Error: required argument --{name} not provided.", file=sys.stderr)
            print(f"Usage: python serena-query.py {tool_name} {' '.join('--' + n for n, pp in params.items() if pp.default is inspect.Parameter.empty)}", file=sys.stderr)
            sys.exit(1)

    # Execute
    raw = agent.execute_task(lambda: tool.apply(**kwargs))
    print(to_toon(tool_name, raw))


# ─── Tool name aliases (snake_case CLI name → Serena class name) ───
TOOL_ALIASES = {}


def resolve_tool_name(cli_name: str) -> str:
    """Convert CLI tool name to Serena tool name. E.g. find_symbol → FindSymbolTool"""
    if cli_name in TOOL_ALIASES:
        return TOOL_ALIASES[cli_name]
    # Convert snake_case to PascalCase + Tool suffix
    parts = cli_name.split('_')
    pascal = ''.join(p.capitalize() for p in parts)
    if not pascal.endswith('Tool'):
        pascal += 'Tool'
    return pascal


if __name__ == '__main__':
    args = sys.argv[1:]
    project = None
    if '--project' in args:
        idx = args.index('--project')
        if idx + 1 < len(args):
            project = os.path.abspath(args[idx + 1])
            args = args[:idx] + args[idx + 2:]

    if len(args) < 1:
        print("Serena LSP Query CLI (generic dispatcher)")
        print("Usage: python serena-query.py [--project <path>] <tool_name> [--param value ...]")
        print()
        print("Tools: find_symbol, get_symbols_overview, find_referencing_symbols,")
        print("       search_for_pattern, list_dir, find_file, read_file, activate_project")
        print()
        print("All --param names match Serena's apply() arguments directly.")
        sys.exit(1)

    get_agent(project)
    tool_cls_name = resolve_tool_name(args[0])
    dispatch(tool_cls_name, args[1:])
