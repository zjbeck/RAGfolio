import { ChatApp } from "@/components/chat/ChatApp";
import { TopNav } from "@/components/nav/TopNav";
import { getForestData, getNavTabs } from "@/lib/corpus/server-data";

export default function Home() {
  const forest = getForestData();
  const tabs = getNavTabs();

  return (
    <div className="flex h-dvh flex-col">
      <TopNav tabs={tabs} />
      <ChatApp forest={forest} />
    </div>
  );
}
