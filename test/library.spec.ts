import { createClient } from './test-client';

describe('Library', () => {
  it('should get all sections', async () => {
    const server = await createClient();
    const library = await server.library();
    const sections = await library.sections();
    expect(sections).toHaveLength(2);
    expect(sections[0].type).toBe('movie');
    expect(sections[1].type).toBe('show');
  });
});
