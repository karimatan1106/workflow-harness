/**
 * DCI (Design-Code Index) type definitions
 * @spec docs/spec/features/workflow-harness.md
 */

export interface DCICodeEntry {
  specs: string[];
  layer1: string;
}

export interface DCIDesignEntry {
  implementedBy: string[];
  testedBy: string[];
  layer1: string;
}

export interface DCIIndex {
  version: string;
  generatedAt: string;
  projectRoot: string;
  codeToDesign: Record<string, DCICodeEntry>;
  designToCode: Record<string, DCIDesignEntry>;
  orphans: {
    codeWithoutSpec: string[];
    specWithoutCode: string[];
  };
}
