import ReactMarkdown from "react-markdown";

const mdProse = [
  "space-y-4 text-base leading-relaxed text-foreground",
  "[&_h2]:mt-8 [&_h2]:scroll-mt-4 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-foreground [&_h2]:first:mt-0",
  "[&_p]:text-foreground",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-medium",
].join(" ");

type ModuleArticleProps = Readonly<{
  markdown: string;
}>;

/**
 * Renders module body with the same density as conversation answers: base size, relaxed line height.
 */
export function ModuleArticle({ markdown }: ModuleArticleProps) {
  return (
    <article className={mdProse} data-testid="module-article-body">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </article>
  );
}
