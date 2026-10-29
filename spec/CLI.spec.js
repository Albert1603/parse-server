'use strict';
let commander;
const definitions = require('../lib/cli/definitions/parse-server').default;
const liveQueryDefinitions = require('../lib/cli/definitions/parse-live-query-server').default;
const path = require('path');
const { spawn } = require('child_process');

const testDefinitions = {
  arg0: 'PROGRAM_ARG_0',
  arg1: {
    env: 'PROGRAM_ARG_1',
    required: true,
  },
  arg2: {
    env: 'PROGRAM_ARG_2',
    action: function (value) {
      const intValue = parseInt(value);
      if (!Number.isInteger(intValue)) {
        throw 'arg2 is invalid';
      }
      return intValue;
    },
  },
  arg3: {},
  arg4: {
    default: 'arg4Value',
  },
};

describe('commander additions', () => {
  beforeEach(() => {
    const command = require('../lib/cli/utils/commander').default;
    commander = new command.constructor();
    commander.storeOptionsAsProperties();
    commander.allowExcessArguments();
  });
  afterEach(done => {
    commander.options = [];
    delete commander.arg0;
    delete commander.arg1;
    delete commander.arg2;
    delete commander.arg3;
    delete commander.arg4;
    done();
  });

  it('should load properly definitions from args', done => {
    commander.loadDefinitions(testDefinitions);
    commander.parse([
      'node',
      './CLI.spec.js',
      '--arg0',
      'arg0Value',
      '--arg1',
      'arg1Value',
      '--arg2',
      '2',
      '--arg3',
      'some',
    ]);
    expect(commander.arg0).toEqual('arg0Value');
    expect(commander.arg1).toEqual('arg1Value');
    expect(commander.arg2).toEqual(2);
    expect(commander.arg3).toEqual('some');
    expect(commander.arg4).toEqual('arg4Value');
    done();
  });

  it('should load properly definitions from env', done => {
    commander.loadDefinitions(testDefinitions);
    commander.parse([], {
      PROGRAM_ARG_0: 'arg0ENVValue',
      PROGRAM_ARG_1: 'arg1ENVValue',
      PROGRAM_ARG_2: '3',
    });
    expect(commander.arg0).toEqual('arg0ENVValue');
    expect(commander.arg1).toEqual('arg1ENVValue');
    expect(commander.arg2).toEqual(3);
    expect(commander.arg4).toEqual('arg4Value');
    done();
  });

  it('should load properly use args over env', () => {
    commander.loadDefinitions(testDefinitions);
    commander.parse(['node', './CLI.spec.js', '--arg0', 'arg0Value', '--arg4', ''], {
      PROGRAM_ARG_0: 'arg0ENVValue',
      PROGRAM_ARG_1: 'arg1ENVValue',
      PROGRAM_ARG_2: '4',
      PROGRAM_ARG_4: 'arg4ENVValue',
    });
    expect(commander.arg0).toEqual('arg0Value');
    expect(commander.arg1).toEqual('arg1ENVValue');
    expect(commander.arg2).toEqual(4);
    expect(commander.arg4).toEqual('');
  });

  it('should fail in action as port is invalid', done => {
    commander.loadDefinitions(testDefinitions);
    expect(() => {
      commander.parse(['node', './CLI.spec.js', '--arg0', 'arg0Value'], {
        PROGRAM_ARG_0: 'arg0ENVValue',
        PROGRAM_ARG_1: 'arg1ENVValue',
        PROGRAM_ARG_2: 'hello',
      });
    }).toThrow('arg2 is invalid');
    done();
  });

  it('should not override config.json', done => {
    spyOn(console, 'log').and.callFake(() => {});
    commander.loadDefinitions(testDefinitions);
    commander.parse(
      ['node', './CLI.spec.js', '--arg0', 'arg0Value', './spec/configs/CLIConfig.json'],
      {
        PROGRAM_ARG_0: 'arg0ENVValue',
        PROGRAM_ARG_1: 'arg1ENVValue',
      }
    );
    const options = commander.getOptions();
    expect(options.arg2).toBe(8888);
    expect(options.arg3).toBe('hello'); //config value
    expect(options.arg4).toBe('/1');
    done();
  });

  it('should fail with invalid values in JSON', done => {
    commander.loadDefinitions(testDefinitions);
    expect(() => {
      commander.parse(
        ['node', './CLI.spec.js', '--arg0', 'arg0Value', './spec/configs/CLIConfigFail.json'],
        {
          PROGRAM_ARG_0: 'arg0ENVValue',
          PROGRAM_ARG_1: 'arg1ENVValue',
        }
      );
    }).toThrow('arg2 is invalid');
    done();
  });

  it('should fail when too many apps are set', done => {
    commander.loadDefinitions(testDefinitions);
    expect(() => {
      commander.parse(['node', './CLI.spec.js', './spec/configs/CLIConfigFailTooManyApps.json']);
    }).toThrow('Multiple apps are not supported');
    done();
  });

  it('should load config from apps', done => {
    spyOn(console, 'log').and.callFake(() => {});
    commander.loadDefinitions(testDefinitions);
    commander.parse(['node', './CLI.spec.js', './spec/configs/CLIConfigApps.json']);
    const options = commander.getOptions();
    expect(options.arg1).toBe('my_app');
    expect(options.arg2).toBe(8888);
    expect(options.arg3).toBe('hello'); //config value
    expect(options.arg4).toBe('/1');
    done();
  });

  it('should fail when passing an invalid arguement', done => {
    commander.loadDefinitions(testDefinitions);
    expect(() => {
      commander.parse(['node', './CLI.spec.js', './spec/configs/CLIConfigUnknownArg.json']);
    }).toThrow('error: unknown option myArg');
    done();
  });
});

describe('definitions', () => {
  it('should have valid types', () => {
    for (const key in definitions) {
      const definition = definitions[key];
      expect(typeof definition).toBe('object');
      if (typeof definition.env !== 'undefined') {
        expect(typeof definition.env).toBe('string');
      }
      expect(typeof definition.help).toBe('string');
      if (typeof definition.required !== 'undefined') {
        expect(typeof definition.required).toBe('boolean');
      }
      if ('action' in definition) {
        expect(typeof definition.action).toBe('function');
      }
    }
  });

  it('should throw when using deprecated facebookAppIds', () => {
    expect(() => {
      definitions.facebookAppIds.action();
    }).toThrow();
  });

  it('should coerce the NumberOrBoolean cluster option value', () => {
    const action = definitions.cluster.action;
    expect(typeof action).toBe('function');
    expect(action('2')).toBe(2);
    expect(action('true')).toBe(true);
    expect(action('false')).toBe(false);
  });
});

describe('LiveQuery definitions', () => {
  it('should have valid types', () => {
    for (const key in liveQueryDefinitions) {
      const definition = liveQueryDefinitions[key];
      expect(typeof definition).toBe('object');
      if (typeof definition.env !== 'undefined') {
        expect(typeof definition.env).toBe('string');
      }
      expect(typeof definition.help).toBe('string', `help for ${key} should be a string`);
      if (typeof definition.required !== 'undefined') {
        expect(typeof definition.required).toBe('boolean');
      }
      if ('action' in definition) {
        expect(typeof definition.action).toBe('function');
      }
    }
  });
});

describe('execution', () => {
  const binPath = path.resolve(__dirname, '../bin/parse-server');
  let childProcess;

  function waitForStartup(cp, requiredOutput) {
    return new Promise((resolve, reject) => {
      const aggregated = [];
      cp.stdout.on('data', data => {
        aggregated.push(data.toString());
        if (requiredOutput.every(r => aggregated.some(a => a.includes(r)))) {
          resolve();
        }
      });
      cp.on('error', reject);
    });
  }

  afterEach(done => {
    if (childProcess) {
      childProcess.on('close', () => {
        childProcess = undefined;
        done();
      });
      childProcess.kill();
    } else {
      done();
    }
  });

  it_id('a0ab74b4-f805-4e03-b31d-b5cd59e64495')(it)('should start Parse Server', async () => {
    const env = { ...process.env };
    env.NODE_OPTIONS = '--dns-result-order=ipv4first --trace-deprecation';
    childProcess = spawn(
      binPath,
      ['--appId', 'test', '--masterKey', 'test', '--databaseURI', databaseURI, '--port', '1339'],
      { env }
    );
    await waitForStartup(childProcess, ['parse-server running on']);
  });

  it_id('d7165081-b133-4cba-901b-19128ce41301')(it)('should start Parse Server with GraphQL', async () => {
    const env = { ...process.env };
    env.NODE_OPTIONS = '--dns-result-order=ipv4first --trace-deprecation';
    childProcess = spawn(
      binPath,
      [
        '--appId',
        'test',
        '--masterKey',
        'test',
        '--databaseURI',
        databaseURI,
        '--port',
        '1340',
        '--mountGraphQL',
      ],
      { env }
    );
    await waitForStartup(childProcess, ['parse-server running on', 'GraphQL running on']);
  });

  it_id('2769cdb4-ce8a-484d-8a91-635b5894ba7e')(it)('should start Parse Server with GraphQL and Playground', async () => {
    const env = { ...process.env };
    env.NODE_OPTIONS = '--dns-result-order=ipv4first --trace-deprecation';
    childProcess = spawn(
      binPath,
      [
        '--appId',
        'test',
        '--masterKey',
        'test',
        '--databaseURI',
        databaseURI,
        '--port',
        '1341',
        '--mountGraphQL',
        '--mountPlayground',
      ],
      { env }
    );
    await waitForStartup(childProcess, [
      'parse-server running on',
      'Playground running on',
      'GraphQL running on',
    ]);
  });

  it_id('23caddd7-bfea-4869-8bd4-0f2cd283c8bd')(it)('can start Parse Server with auth via CLI', async () => {
    const env = { ...process.env };
    env.NODE_OPTIONS = '--dns-result-order=ipv4first --trace-deprecation';
    childProcess = spawn(
      binPath,
      ['--databaseURI', databaseURI, './spec/configs/CLIConfigAuth.json'],
      { env }
    );
    await waitForStartup(childProcess, ['parse-server running on']);
  });

  // Parse Server handles termination signals only outside of tests, so the process runs without TESTING
  async function startAndTerminate(args, signals) {
    const env = { ...process.env };
    env.NODE_OPTIONS = '--dns-result-order=ipv4first --trace-deprecation';
    delete env.TESTING;
    childProcess = spawn(binPath, args, { env });
    let output = '';
    childProcess.stdout.on('data', data => (output += data));
    childProcess.stderr.on('data', data => (output += data));
    await waitForStartup(childProcess, ['parse-server running on']);
    const exit = new Promise(resolve => {
      childProcess.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const killTimeout = setTimeout(() => childProcess.kill('SIGKILL'), 5000);
    signals.forEach(signal => childProcess.kill(signal));
    const { code, signal } = await exit;
    clearTimeout(killTimeout);
    childProcess = undefined;
    return { code, signal, output };
  }

  it('should shut down once on repeated termination signals', async () => {
    // The OS can merge a pending signal with the same signal, but not with a different one
    const { code, signal, output } = await startAndTerminate(
      ['--appId', 'test', '--masterKey', 'test', '--databaseURI', databaseURI, '--port', '1342'],
      ['SIGTERM', 'SIGINT']
    );
    expect(signal).toBeNull();
    expect(code).toBe(0);
    expect(output.match(/Shutting down\./g).length).toBe(1);
    expect(output).toContain('Termination signal received. Shutdown already in progress.\n');
    expect(output).not.toContain('Error while closing parse server');
  });

  const it_only_redis = process.env.PARSE_SERVER_TEST_CACHE === 'redis' ? it : xit;

  it_only_redis('should exit after a termination signal with Redis cache and LiveQuery', async () => {
    const { code, signal, output } = await startAndTerminate(
      [
        '--appId',
        'test',
        '--masterKey',
        'test',
        '--databaseURI',
        databaseURI,
        '--port',
        '1343',
        '--cacheAdapter',
        JSON.stringify({
          module: path.resolve(__dirname, '../lib/Adapters/Cache/RedisCacheAdapter'),
          options: { url: 'redis://localhost:6379' },
        }),
        '--liveQuery',
        JSON.stringify({ classNames: ['TestObject'], redisURL: 'redis://localhost:6379' }),
      ],
      ['SIGTERM', 'SIGINT']
    );
    expect(signal).toBeNull();
    expect(code).toBe(0);
    expect(output).not.toContain('error on shutdown');
  });
});
