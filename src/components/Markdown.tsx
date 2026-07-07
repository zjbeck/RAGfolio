import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

/**
 * Shared markdown renderer for streamed answers and the doc rendered view.
 * rehype-slug assigns heading ids using the same slugging as ingest's
 * github-slugger, so citation anchors (docSlug#anchorId) land on the heading.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-rag">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
