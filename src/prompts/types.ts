export interface PromptTemplate<V> {
  id: string;
  version: number;
  label: string;
  description: string;
  temperature: number;
  system: string;
  buildUser(vars: V): string;
}
