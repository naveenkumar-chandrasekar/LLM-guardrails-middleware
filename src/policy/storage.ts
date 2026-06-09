import fs from "fs";
import path from "path";

export interface PolicyStorageAdapter {
  load(filename: string): Promise<string>;
  save(filename: string, content: string): Promise<void>;
  list(): Promise<string[]>;
}

export class FileSystemAdapter implements PolicyStorageAdapter {
  constructor(private dir: string) {}

  async load(filename: string): Promise<string> {
    return fs.readFileSync(path.join(this.dir, filename), "utf-8");
  }

  async save(filename: string, content: string): Promise<void> {
    fs.writeFileSync(path.join(this.dir, filename), content, "utf-8");
  }

  async list(): Promise<string[]> {
    return fs.readdirSync(this.dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  }
}

export class InMemoryAdapter implements PolicyStorageAdapter {
  private store: Map<string, string>;

  constructor(policies: Record<string, string> = {}) {
    this.store = new Map(Object.entries(policies));
  }

  async load(filename: string): Promise<string> {
    const content = this.store.get(filename);
    if (!content) throw new Error(`Policy not found: ${filename}`);
    return content;
  }

  async save(filename: string, content: string): Promise<void> {
    this.store.set(filename, content);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }
}
