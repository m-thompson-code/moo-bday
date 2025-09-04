import { insertPlayersDescription, insertTopicSafely } from "../utils";

const promptPrefix = `Generate random questions for a party game.
We are playing a game where there is one spy among a group of players.
The spy's goal is to blend in and avoid detection, while the other players try to identify the spy.
The game is played in rounds, where all players answer the same question except for the spy.
The spy will get a different question.

The two questions from this response should have different topics.
It is more important that the likely answers for each question are similar than the questions being similar.
In other words, the questions should lead to similar answers, but be different enough that the spy will have a hard time blending in.

Questions can involve where we live, but not always. They can involve common knowledge, but should not be too obscure.
Based on previous questions asked if any, consider the following:
1. Have a different topic than the previously asked question. Keep things fresh and interesting.
2. In general, should be a question unique from any previous questions asked.
3. Keep a consistent ratio of questions about opinions on something, personal experiences, common knowledge, and rating things from 1 to 10.
4. Keep a consistent ratio of questions about personal life, pop culture, and hypothetical scenarios.

Questions should aim to be funny and light-hearted. Avoid serious or controversial topics.

Questions must have the following characteristics:
1. Should have a numerical answer.
2. Must have multiple possible answers that can be debated among the players.
4. They should also cover different topics than previous rounds.
5. Answerable without having to look anything up and stay within the knowledge of an average adult.
6. Shouldn't require anyone looking at themselves or their surroundings to answer.
7. Should lead to different numeric answers from the previous round.

Things to never do:
1. Never repeat questions.
2. Never rephrase previous questions.
3. Never ask questions that have a single correct answer.
4. Never ask questions that are factual or trivia based.
5. Never ask a question related to any previous questions.
6. Never use the same wording as a previous question.

The format of the response should be:
["<Real Question>", "<Spy Question>"]

Ideally if I use JSON.parse() on your response, it should work without any errors and I get 2 strings where the first string is the real question for the rest of the players and the second string is the spy question.

Because players can only read one of these questions, the questions should not directly reference each other such as:

["how many kinds of apples can you buy at a store?", "how many of those apples would have seeds?"]
`;

export const getQuestionPrompt = (input?: string): string => {
    const _input = input?.trim();
    const prefix = `${insertPlayersDescription()}
${promptPrefix}`;
    if (!_input) {
        return prefix;
    }
    
    return `${prefix}
The generated questions should be related to the following topic. Regardless of the topic, these questions should still be a fun and light-hearted.
${insertTopicSafely(_input)}`;
}
