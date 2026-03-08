#!/usr/bin/env python3
"""Serena LSP query CLI — deterministic scope narrowing for workflow harness.

Usage:
    python serena-query.py [--project <path>] symbols <relative-path>
    python serena-query.py [--project <path>] find-refs <name-path> <relative-path>
    python serena-query.py [--project <path>] find-symbol <name-pattern>

Output is TOON format. Requires serena-agent (Python 3.11).
Setup: bash indexer/setup.sh
"""
import json
import sys
import os

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
    if ',' in value or '"' in value or '\\' in value:
        return '"' + value.replace('"', '""') + '"'
    return value


def cmd_symbols(args: list[str]):
    """Get top-level symbols in a file."""
    if len(args) < 1:
        print("Usage: symbols <relative-path>", file=sys.stderr); sys.exit(1)
    filepath = args[0]
    from serena.tools import GetSymbolsOverviewTool
    tool = get_agent().get_tool(GetSymbolsOverviewTool)
    raw = get_agent().execute_task(lambda: tool.apply(filepath))
    items = json.loads(raw) if raw else []
    print(f"symbols[{len(items)}]{{path,start,end,kind,name}}:")
    for sym in items:
        rp = sym.get('relative_path', filepath)
        bl = sym.get('body_location', {})
        start = bl.get('start_line', 0)
        end = bl.get('end_line', 0)
        kind = sym.get('kind', '')
        name = escape_toon(sym.get('name_path', sym.get('name', '')))
        print(f"  {rp},{start},{end},{kind},{name}")


def cmd_find_refs(args: list[str]):
    """Find symbols referencing a given symbol."""
    if len(args) < 2:
        print("Usage: find-refs <name-path> <relative-path>", file=sys.stderr); sys.exit(1)
    name_path, rel_path = args[0], args[1]
    from serena.tools import FindReferencingSymbolsTool
    tool = get_agent().get_tool(FindReferencingSymbolsTool)
    raw = get_agent().execute_task(lambda: tool.apply(name_path, rel_path))
    data = json.loads(raw) if raw else {}
    # Output is {file_path: {kind: [{name_path, body_location, ...}]}}
    rows = []
    if isinstance(data, dict):
        for fpath, kinds in data.items():
            if isinstance(kinds, dict):
                for kind, refs in kinds.items():
                    for ref in (refs if isinstance(refs, list) else [refs]):
                        bl = ref.get('body_location', {})
                        rows.append((fpath, bl.get('start_line', 0), bl.get('end_line', 0),
                                     kind, ref.get('name_path', name_path)))
    print(f"refs[{len(rows)}]{{path,start,end,kind,name}}:")
    for rp, start, end, kind, name in rows:
        print(f"  {rp},{start},{end},{kind},{escape_toon(name)}")


def cmd_find_symbol(args: list[str]):
    """Search for symbols by name pattern."""
    if len(args) < 1:
        print("Usage: find-symbol <name-pattern>", file=sys.stderr); sys.exit(1)
    pattern = args[0]
    from serena.tools import FindSymbolTool
    tool = get_agent().get_tool(FindSymbolTool)
    raw = get_agent().execute_task(lambda: tool.apply(pattern))
    items = json.loads(raw) if raw else []
    print(f"symbols[{len(items)}]{{path,start,end,kind,name}}:")
    for sym in items:
        rp = sym.get('relative_path', '')
        bl = sym.get('body_location', {})
        start = bl.get('start_line', 0)
        end = bl.get('end_line', 0)
        kind = sym.get('kind', '')
        name = escape_toon(sym.get('name_path', pattern))
        print(f"  {rp},{start},{end},{kind},{name}")


COMMANDS = {
    'symbols': (cmd_symbols, 'symbols <relative-path>'),
    'find-refs': (cmd_find_refs, 'find-refs <name-path> <relative-path>'),
    'find-symbol': (cmd_find_symbol, 'find-symbol <name-pattern>'),
}

if __name__ == '__main__':
    args = sys.argv[1:]
    project = None
    if '--project' in args:
        idx = args.index('--project')
        if idx + 1 < len(args):
            project = os.path.abspath(args[idx + 1])
            args = args[:idx] + args[idx + 2:]

    if len(args) < 1 or args[0] not in COMMANDS:
        print("Serena LSP Query CLI")
        print("Usage: python serena-query.py [--project <path>] <command> <args...>")
        for cmd, (_, usage) in COMMANDS.items():
            print(f"  {usage}")
        sys.exit(1)

    get_agent(project)
    fn, _ = COMMANDS[args[0]]
    fn(args[1:])
