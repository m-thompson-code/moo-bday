import { getPromptTopic } from "./prompt-topic";
import { promptPrefix } from "./prompt-prefix";
import { insertPlayersDescription } from "../utils";

export const getTopicPrompt = (input: string): string => {
  return `${insertPlayersDescription()}
${promptPrefix}
${getPromptTopic(input)}`;
};
