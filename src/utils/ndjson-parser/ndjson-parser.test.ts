import { createRepairingJSONParser } from './ndjson-parser';

const tests = [];

/* 1 */
tests.push([
	{ chunk: '{\n  ' },
	{
		chunk:
			'"description": "A classic Tic-Tac-Toe game where two players, \'X\' and \'O\', take turns marking"',
	},
]);

/* 2 */
tests.push([
	{ chunk: '{ "user": { "name": "Alice' },
	{ chunk: ', "age": 30' },
	{ chunk: ', "favorites": ["apples", "bananas"' },
]);

/* 3 */
tests.push([{ chunk: '{\n  "title": "Tic Tac Toe Game",\n  "firstFile"' }]);

/* 4 */
tests.push([
	{
		chunk:
			'{\n  "userFlow": {\n    "userJourney": "1. The user opens the application and',
	},
	{
		chunk:
			" sees a 3x3 Tic Tac Toe board, a status message indicating 'Next player: X', and a 'Reset Game' button.\\n2",
	},
	{
		chunk:
			". The user clicks on an empty square on the board.\\n3. The square is filled with the current player's mark",
	},
	{
		chunk:
			" ('X').\\n4. The status message updates to 'Next player: O'.\\n5. The next",
	},
	{
		chunk:
			" user (or the same user playing as 'O') clicks on another empty square.\\n6. The square is filled with '",
	},
	{
		chunk:
			"O'.\\n7. The status message updates back to 'Next player: X'.\\n8. Steps 2",
	},
	{
		chunk:
			'-7 repeat.\\n9. If a player gets three of their marks in a row (horizontally, vertically, or diagonally),',
	},
	{
		chunk:
			" the game ends.\\n10. The status message updates to 'Winner: [X or O]'. Clicking on squares",
	},
]);

/* 5 */
tests.push([
	{ chunk: '{\n  "commands": {' },
	{
		chunk:
			'\n    "setup": [\n      "npm install"\n    ],\n    "lint": "npm run lint",\n    "deploy":',
	},
]);

tests.push([
	{ chunk: '{\n  "description": "A minimalist, modern, and responsive' },
	{
		chunk:
			' Tic-Tac-Toe game built with React, Vite, TypeScript, and Tailwind CSS. The game allows two players,',
	},
	{
		chunk:
			" 'X' and 'O', to take turns marking spaces in a 3x3 grid. The application detects win",
	},
	{
		chunk:
			' conditions (three marks in a row, column, or diagonal) and draw conditions (all squares filled with no winner). It',
	},
	{
		chunk:
			' displays the current game status and provides an option to reset the game.",\n  "userFlow": {\n    "uiDesign": "The UI',
	},
	{
		chunk:
			' features a clean, centered layout. A 3x3 grid forms the game board, composed of distinct clickable squares. Above',
	},
]);

tests.forEach((chunks, i) => {
	const p = createRepairingJSONParser();
	chunks.forEach((c) => p.feed(c.chunk));
	console.log(`Test-${i + 1}:`, JSON.stringify(p.finalize(), null, 2));
});
