import { ChatApp } from "@/components/chat/ChatApp";
import { TopNav } from "@/components/nav/TopNav";
import { getForestData, getNavTabs, getSuggestedPrompts } from "@/lib/corpus/server-data";

export default function Home() {
  const forest = getForestData();
  const tabs = getNavTabs();
  const suggestedPrompts = getSuggestedPrompts();

  return (
    <div className="flex h-dvh flex-col">
      <TopNav tabs={tabs} />
      <ChatApp forest={forest} suggestedPrompts={suggestedPrompts} />
    </div>
  );
}
