import { insertTopicSafely } from "../utils";

export const getPromptTopic = (
    input: string,
) => `
The generated response should be random, light-hearted and fun.
This is for a party with a group of close friends.

${insertTopicSafely(input)}`;
