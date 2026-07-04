import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { supabase } from "./supabase";
import QuickCal from "./App";

const mono = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

function Gate() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <Center>loading…</Center>;
  }

  if (!session) {
    return (
      <Center>
        <button
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: "github",
              options: { redirectTo: window.location.origin },
            })
          }
          style={{
            padding: "14px 28px",
            borderRadius: 12,
            background: "#D7E0EA",
            border: "none",
            fontFamily: mono,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
            cursor: "pointer",
          }}
        >
          SIGN IN WITH GITHUB
        </button>
      </Center>
    );
  }

  return <QuickCal onSignOut={() => supabase.auth.signOut()} />;
}

function Center({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0B0E14",
        color: "#5A6B80",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: mono,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Gate />);
