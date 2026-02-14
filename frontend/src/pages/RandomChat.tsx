import { useEffect, useRef, useState } from "react";
import { useRandomChat } from "../hooks/useRandomChat";
import { useAuthContext } from "../context/AuthProvider";
import RandomChatLanding from "../components/randomChat/RandomChatLanding";
import SearchingOverlay from "../components/randomChat/SearchingOverlay";
import RandomChatRoom, {
  PartnerLeftOverlay,
} from "../components/randomChat/RandomChatRoom";

export default function RandomChat() {
  const { user } = useAuthContext();
  const rc = useRandomChat();

  const [partnerLeftCountdown, setPartnerLeftCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle partner-left countdown
  useEffect(() => {
    if (rc.state === "partner-left") {
      setPartnerLeftCountdown(3);
      countdownRef.current = setInterval(() => {
        setPartnerLeftCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [rc.state]);

  if (rc.state === "idle") {
    return <RandomChatLanding onStart={rc.startSearching} />;
  }

  if (rc.state === "searching") {
    return (
      <SearchingOverlay
        searchTime={rc.searchTime}
        onCancel={rc.cancelSearch}
      />
    );
  }

  if (rc.state === "partner-left") {
    return <PartnerLeftOverlay countdown={partnerLeftCountdown} />;
  }

  // matched
  return (
    <RandomChatRoom
      partnerName={rc.partnerName}
      chatDuration={rc.chatDuration}
      onNext={rc.next}
      onLeave={rc.leave}
      messages={rc.messages}
      sendChat={rc.sendChat}
      setTyping={rc.setTyping}
      participants={rc.participants}
      selfId={user?.id}
    />
  );
}
