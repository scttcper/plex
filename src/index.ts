/**
 * A comment about DummyClass
 * It's a great class
 */
export class DummyClass {
  value = true;

  async load(): Promise<string> {
    const something = await Promise.resolve({ text: 'text' });
    return something.text;
  }
}
