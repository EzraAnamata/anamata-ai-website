import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Insights — field notes. Provenance frontmatter is mandatory: every article
 * carries who drafted it and the named human who approved it (Art. 50(4)).
 */
const insights = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/insights' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    published: z.coerce.date(),
    draftedBy: z.string(),
    approvedBy: z.string(),
    record: z.string(), // record number in the continuous site record, e.g. "005"
  }),
});

export const collections = { insights };
