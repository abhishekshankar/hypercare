import { strToU8, zipSync } from "fflate";

import { collectPrivacyExportData, createDbClient } from "@hypercare/db";

type Db = ReturnType<typeof createDbClient>;

export function buildExportZipBuffer(db: Db, userId: string): Promise<Uint8Array> {
  return (async () => {
    const data = await collectPrivacyExportData(db, userId);
    const json = JSON.stringify(data, null, 2);
    const out = zipSync({ "hypercare_export.json": strToU8(json) });
    return out;
  })();
}
