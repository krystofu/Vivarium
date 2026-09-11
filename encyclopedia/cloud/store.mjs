export function cloudStore(env, seed) {
  return {
    async read() {
      const row = await env.DB.prepare('SELECT document FROM library WHERE id = ?').bind('main').first();
      return row ? JSON.parse(row.document) : structuredClone(seed);
    },
    async mutate(change) {
      await env.DB.prepare('INSERT OR IGNORE INTO library (id, revision, document) VALUES (?, 0, ?)').bind('main',JSON.stringify(seed)).run();
      for(let attempt=0;attempt<8;attempt++) {
        const row=await env.DB.prepare('SELECT revision, document FROM library WHERE id = ?').bind('main').first();
        const db=JSON.parse(row.document);const result=await change(db);
        const saved=await env.DB.prepare('UPDATE library SET document = ?, revision = revision + 1 WHERE id = ? AND revision = ?').bind(JSON.stringify(db),'main',row.revision).run();
        if(saved.meta.changes===1) return result;
      }
      throw Object.assign(new Error('The library changed while saving. Please try again.'),{status:409});
    }
  };
}
