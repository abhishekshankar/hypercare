import { ScreenHeader } from "@/components/screen-header";
import { LibraryBrowse } from "@/components/library/LibraryBrowse";
import { loadLibraryModuleList } from "@/lib/library/load-list";

export default async function LibraryPage() {
  const modules = await loadLibraryModuleList();

  return (
    <>
      <ScreenHeader title="Library." />
      <LibraryBrowse modules={modules} />
    </>
  );
}
