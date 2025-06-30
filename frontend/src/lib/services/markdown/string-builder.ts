// string-builder.ts
export class StringBuilder {
  private chunks: string[] = [];

  append(str: string): void {
    this.chunks.push(str);
  }

  toString(): string {
    const result = this.chunks.join('');
    this.chunks = [];
    return result;
  }

  clear(): void {
    this.chunks = [];
  }
}
