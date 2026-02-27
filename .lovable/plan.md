

## Plan: Enhanced Export with Article-Named Fiche Technique Folders

### Current State
- Export already fetches all 13 tables and files from `fiches-techniques` bucket under `fiches/` prefix
- All storage files are dumped flat into a single `fiches-techniques/` folder in the ZIP
- No organization by article name

### Changes

#### File: `src/services/dbService.ts` — `exportDatabase` function

1. **List ALL storage files** (not just `fiches/` subfolder) — also list root-level files and any other subfolders to capture all uploaded content (article images stored there too)

2. **Build article-name mapping**: After fetching `products` and `product_groups`, create a map from storage file path → article (product group) name by parsing `fiche_technique_url` and `image` fields from:
   - `products` table (map via `product_group_id` → group name)
   - `product_group_fournisseurs` table (map via `product_group_id` → group name)
   - `product_groups` table (for group images)

3. **Organize ZIP structure**:
   ```
   data.json
   fiches-techniques/
     ArticleName1/
       file1.webp
       file2.webp
     ArticleName2/
       file3.webp
     _unlinked/
       orphan-file.webp
   ```
   - Sanitize article names for folder safety (remove `/`, `\`, etc.)
   - Files not linked to any article go into `_unlinked/`

4. **List storage recursively**: Use `supabase.storage.from('fiches-techniques').list()` with empty path first, then list subfolders to get all files (the bucket may have files at root, `fiches/`, or other paths)

5. **Update import** to handle both old flat format and new article-folder format — on import, flatten all files back to their original storage paths using the URL references in `data.json`

### No DB changes needed

