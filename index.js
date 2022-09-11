const upadateParserState = (state, index, result) => ({
  ...state,
  index,
  result,
});

const upadateParserResult = (state, result) => ({
  ...state,
  result,
});

const upadateParserError = (state, errorMessage) => ({
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
}

const str = (s) =>
  new Parser((parserState) => {
    const { targetString, index, isError } = parserState;

    if (isError) {
      return parserState;
    }

    const slicedTarget = targetString.slice(index);

    if (slicedTarget.length === 0) {
      return upadateParserError(
        parserState,
        `str: Tried to match ${s}, but got unexpected end of input.`
      );
    }

    if (slicedTarget.startsWith(s)) {
      return upadateParserState(parserState, index + s.length, s);
    }

    return upadateParserError(
      parserState,
      `Tried to match ${s}, but got ${targetString.slice(index, index + 10)}`
    );
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

    return upadateParserResult(nextState, results);
  });

const parser = sequenceOf([str('some'), str('string')]);

console.log(parser.run('somestring'));
