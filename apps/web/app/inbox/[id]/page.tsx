"use client";

import { use } from "react";
import { ConversationContent } from "../conversation-content";

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <main>
      <ConversationContent key={id} id={id} />
    </main>
  );
}
