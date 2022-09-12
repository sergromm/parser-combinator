const updateParserState = (state, index, result) => ({
	...state,
	index,
	result,
});

const updateParserResult = (state, result) => ({
	...state,
	result,
});

const updateParserError = (state, errorMessage) => ({
	...state,
	isError: true,
	error: errorMessage,
});

class Parser {
	constructor(parserStateTransformerFn) {
		this.parserStateTransformerFn = parserStateTransformerFn;
	}

	run(targetString) {
		const initialState = {
			targetString,
			index: 0,
			result: null,
			error: null,
			isError: false,
		};
		return this.parserStateTransformerFn(initialState);
	}

	map(fn) {
		return new Parser((parserState) => {
			const nextState = this.parserStateTransformerFn(parserState);

			if (nextState.isError) {
				return nextState;
			}

			return updateParserResult(nextState, fn(nextState.result));
		});
	}

	chain(fn) {
		return new Parser((parserState) => {
			const nextState = this.parserStateTransformerFn(parserState);

			if (nextState.isError) {
				return nextState;
			}

			const nextParser = fn(nextState.result);
			return nextParser.parserStateTransformerFn(nextState);
		});
	}

	errorMap(fn) {
		return new Parser((parserState) => {
			const nextState = this.parserStateTransformerFn(parserState);

			if (!nextState.isError) {
				return nextState;
			}

			return updateParserError(nextState, fn(nextState.error, nextState.index));
		});
	}
}

const str = (s) =>
	new Parser((parserState) => {
		const { targetString, index, isError } = parserState;

		if (isError) {
			return parserState;
		}

		const slicedTarget = targetString.slice(index);

		if (slicedTarget.length === 0) {
			return updateParserError(
				parserState,
				`str: Tried to match ${s}, but got unexpected end of input.`,
			);
		}

		if (slicedTarget.startsWith(s)) {
			return updateParserState(parserState, index + s.length, s);
		}

		return updateParserError(
			parserState,
			`Tried to match ${s}, but got ${targetString.slice(index, index + 10)}`,
		);
	});

const lettersRegex = /^[A-z]+/;

const letters = new Parser((parserState) => {
	const { targetString, index, isError } = parserState;

	if (isError) {
		return parserState;
	}

	const slicedTarget = targetString.slice(index);

	if (slicedTarget.length === 0) {
		return updateParserError(parserState, `letters: Got unexpected end of input.`);
	}

	const regexMatch = slicedTarget.match(lettersRegex);

	if (regexMatch) {
		return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);
	}

	return updateParserError(parserState, `letters: Couldn't match lettres @ index ${index}`);
});

const digitsRegex = /^[0-9]+/;

const digits = new Parser((parserState) => {
	const { targetString, index, isError } = parserState;

	if (isError) {
		return parserState;
	}

	const slicedTarget = targetString.slice(index);

	if (slicedTarget.length === 0) {
		return updateParserError(parserState, `digits: Got unexpected end of input.`);
	}

	const regexMatch = slicedTarget.match(digitsRegex);

	if (regexMatch) {
		return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);
	}

	return updateParserError(parserState, `digits: Couldn't match digits @ index ${index}`);
});

const sequenceOf = (parsers) =>
	new Parser((parserState) => {
		if (parserState.isError) {
			return parserState;
		}
		const results = [];
		let nextState = parserState;

		for (let p of parsers) {
			nextState = p.parserStateTransformerFn(nextState);
			results.push(nextState.result);
		}

		return updateParserResult(nextState, results);
	});

const choice = (parsers) =>
	new Parser((parserState) => {
		if (parserState.isError) {
			return parserState;
		}

		for (let p of parsers) {
			const nextState = p.parserStateTransformerFn(parserState);
			if (!nextState.isError) {
				return nextState;
			}
		}

		return updateParserError(
			parserState,
			`choice: Unabled to match with any parser @ index ${parserState.index}`,
		);
	});

const many = (parser) =>
	new Parser((parserState) => {
		if (parserState.isError) {
			return parserState;
		}

		let nextState = parserState;
		const results = [];
		let done = false;

		while (!done) {
			let testState = parser.parserStateTransformerFn(nextState);
			if (!testState.isError) {
				results.push(testState.result);
				nextState = testState;
			} else {
				done = true;
			}
		}

		return updateParserResult(nextState, results);
	});

const manyOne = (parser) =>
	new Parser((parserState) => {
		if (parserState.isError) {
			return parserState;
		}

		let nextState = parserState;
		const results = [];
		let done = false;

		while (!done) {
			const nextState = parser.parserStateTransformerFn(nextState);
			if (!nextState.isError) {
				results.push(nextState.result);
			} else {
				done = true;
			}
		}

		if (results.length === 0) {
			return updateParserError(
				parserState,
				`manyOne: unable to match any input using parser @ index ${parserState.index}`,
			);
		}

		return updateParserResult(nextState, results);
	});

const between = (leftParser, rightParser) => (contentParser) =>
	sequenceOf([leftParser, contentParser, rightParser]).map(([_, result]) => result);

const stringParser = letters.map((result) => ({
	type: 'string',
	value: result,
}));

const numberParser = digits.map((result) => ({
	type: 'number',
	value: Number(result),
}));

const dicerollParser = sequenceOf([digits, str('d'), digits]).map(([number, _, sides]) => ({
	type: 'diceroll',
	value: [Number(number), Number(sides)],
}));

const sepBy = (seporatorParser) => (valueParser) =>
	new Parser((parserState) => {
		const results = [];
		let nextState = parserState;

		while (true) {
			const thingWeWantState = valueParser.parserStateTransformerFn(nextState);

			if (thingWeWantState.isError) {
				break;
			}
			results.push(thingWeWantState.result);
			nextState = thingWeWantState;

			const separatorState = seporatorParser.parserStateTransformerFn(nextState);
			if (separatorState.isError) {
				break;
			}
			nextState = separatorState;
		}

		return updateParserResult(nextState, results);
	});

const sepByOne = (seporatorParser) => (valueParser) =>
	new Parser((parserState) => {
		const results = [];
		let nextState = parserState;

		while (true) {
			const thingWeWantState = valueParser.parserStateTransformerFn(nextState);

			if (thingWeWantState.isError) {
				break;
			}
			results.push(thingWeWantState.result);
			nextState = thingWeWantState;

			const separatorState = seporatorParser.parserStateTransformerFn(nextState);
			if (separatorState.isError) {
				break;
			}
			nextState = separatorState;
		}

		if (results.length === 0) {
			return updateParserError(
				parserState,
				`sepByOne: Unable to capture any results @ index ${parserState.index}`,
			);
		}

		return updateParserResult(nextState, results);
	});

const lazy = (parserThunk) =>
	new Parser((parserState) => {
		const parser = parserThunk();
		return parser.parserStateTransformerFn(parserState);
	});

const betweenSquareBrackets = between(str('['), str(']'));
const commaSeparated = sepBy(str(','));

// lazily evaluate to workaround JS's "Used before defined" problem.
const value = lazy(() => choice([digits, arrayParser]));

const arrayParser = betweenSquareBrackets(commaSeparated(value));

const example = '[1,[2,[3],4],5]';

console.dir(arrayParser.run(example));

module.exports = {
	str,
	letters,
	digits,
	sequenceOf,
	choice,
	many,
	manyOne,
	between,
	sepBy,
	sepByOne,
	lazy,
};
