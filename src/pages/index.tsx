import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { getQuestionPrompt, getTopicPrompt, insertAvoidRepeatResponses } from "../prompts";
import { TextUIPart } from "ai";

const getQuestions = async () => {
  console.log("loading...");
    const res = await fetch("/api/get-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            /* prompt?: "optional custom prompt" */
        }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.json();
};

export default function Chat() {
    const [input, setInput] = useState("");
    const { messages, sendMessage } = useChat();

    const prompt = getQuestionPrompt(input);

    const responses = messages
        .filter((message) => message.role !== "user")
        .map((message) =>
            message.parts
                .filter((part): part is TextUIPart => part.type === "text")
                .map((part) => part.text)
                .join(""),
        )
        .flat();
    const _prompt = insertAvoidRepeatResponses(responses, prompt);

    const onClick = () => {
        getQuestions().then(console.log);
    };
    return (
        <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
            {messages.map((message) => (
                <div key={message.id} className="whitespace-pre-wrap">
                    {message.role === "user" ? "User: " : "AI: "}
                    {message.parts.map((part, i) => {
                        switch (part.type) {
                            case "text":
                                return <div key={`${message.id}-${i}`}>{part.text}</div>;
                        }
                    })}
                </div>
            ))}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage({ text: _prompt });
                    setInput("");
                }}
            >
                <input
                    className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
                    value={input}
                    placeholder="Say something..."
                    onChange={(e) => setInput(e.currentTarget.value)}
                />
            </form>
            <button onClick={onClick}>Test</button>
        </div>
    );
}
