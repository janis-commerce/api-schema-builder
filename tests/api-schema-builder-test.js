'use strict';

const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const path = require('path');
const MockFs = require('mock-fs');
const fs = require('fs');

const ApiSchemaBuilder = require('./../lib');

after(() => {
	sandbox.restore();
	MockFs.restore();
});

describe('ApiSchemaBuilder', () => {

	let apiSchemaBuilder;

	describe('isDirectory', () => {

		let directory;

		context('when directories and files exist', () => {

			before(() => {

				MockFs({
					schemas: {
						src: {
							'base.yml': 'Movie API',
							test: {}
						}
					}
				});

				apiSchemaBuilder = new ApiSchemaBuilder();
			});

			after(() => {
				MockFs.restore();
			});

			it('should return TRUE if path is a valid directory', async () => {
				directory = path.join(ApiSchemaBuilder.schemaSrcDir, 'test');

				assert(await apiSchemaBuilder._isDirectory(ApiSchemaBuilder.schemaDir));
				assert(await apiSchemaBuilder._isDirectory(ApiSchemaBuilder.schemaSrcDir));
				assert(await apiSchemaBuilder._isDirectory(directory));
			});

			it('should return FALSE if path is a valid file', async () => {
				directory = path.join(ApiSchemaBuilder.schemaSrcDir, 'base.yml');

				assert(!await apiSchemaBuilder._isDirectory(directory));
			});
		});

		context('when no directories or files exist', () => {

			before(() => {
				MockFs({});

				apiSchemaBuilder = new ApiSchemaBuilder();
			});

			after(() => {
				MockFs.restore();
			});
			it('should return FALSE if path is non valid directory', async () => {

				assert(!await apiSchemaBuilder._isDirectory(ApiSchemaBuilder.schemaDir));
				assert(!await apiSchemaBuilder._isDirectory(ApiSchemaBuilder.schemaSrcDir));
			});

			it('should return FALSE if path is non valid file', async () => {
				directory = path.join(ApiSchemaBuilder.schemaSrcDir, 'base.yml');

				assert(!await apiSchemaBuilder._isDirectory(directory));
			});
		});

	});

	describe('getSourceTree', () => {

		apiSchemaBuilder = new ApiSchemaBuilder();
		const baseFile = path.join(ApiSchemaBuilder.schemaSrcDir, 'public', 'base.yml');
		const catalogListFile = path.join(ApiSchemaBuilder.schemaSrcDir, 'public', 'catalog', 'list.yml');

		before(() => {
			MockFs({
				schemas: {
					src: {
						public: {
							catalog: {
								'list.yml': 'paths:\n /catalog:\n  get'
							},
							'base.yml': 'Api: Movie Fake\n paths: {}'
						},
						'public.json': '{ "Api" : "Movie Fake" }'
					}
				}
			});
		});

		after(() => {
			sandbox.restore();
			MockFs.restore();
		});

		it('should return the correct tree object, ignoring the \'public.json\'', async () => {

			const treeExpected = {
				public: {
					nodes: {
						catalog: {
							nodes: {},
							schemas: [catalogListFile]
						}
					},
					schemas: [baseFile]
				}
			};
			const tree = await apiSchemaBuilder._getSourceTree();

			assert.deepEqual(tree, treeExpected);
		});

		it('should return the correct tree object, when tree params is already init, ignoring the \'public.json\'', async () => {

			const treeExpected = {
				public: {
					nodes: {
						catalog: {
							nodes: {},
							schemas: [catalogListFile]
						}
					},
					schemas: [baseFile]
				}
			};

			const tree = await apiSchemaBuilder._getSourceTree(this.constructor.schemaSrcDir, [], { public: { nodes: {}, schemas: [] } });

			assert.deepEqual(tree, treeExpected);

		});

		it('should reject when directory parametre is not a directory ', async () => {

			await assert.rejects(apiSchemaBuilder._getSourceTree(baseFile));
		});
	});

	describe('mergeSchemas', () => {
		apiSchemaBuilder = new ApiSchemaBuilder();

		it('should merge a list of objects into a single object', () => {

			const pet1 = { best: 'Cats' };
			const pet2 = { worst: 'Dogs' };
			const pet3 = { forbidden: 'Lizards' };

			const merge = apiSchemaBuilder._mergeSchemas([pet1, pet2, pet3]);

			assert.deepEqual(merge, { ...pet1, ...pet2, ...pet3 });
		});

		it('should throw error if nothing to merge', () => {

			assert.throws(() => apiSchemaBuilder._mergeSchemas());
		});
	});

	describe('parseFile', () => {

		apiSchemaBuilder = new ApiSchemaBuilder();

		it('should return an object from a yml string', () => {

			const object = apiSchemaBuilder._parseFile('yml', 'ping: pong');

			assert.deepEqual(object, { ping: 'pong' });
		});

		it('should return an object from a yaml string', () => {

			const object = apiSchemaBuilder._parseFile('yaml', 'ping: pong');

			assert.deepEqual(object, { ping: 'pong' });
		});

		it('should return an object from a JSON string', () => {

			const object = apiSchemaBuilder._parseFile('json', '{ "ping": "pong" }');

			assert.deepEqual(object, { ping: 'pong' });
		});

		it('should throw a SyntaxError from an invalid yml file', () => {

			assert.throws(() => apiSchemaBuilder._parseFile('yml', 'ping & pong\n\ttest'), { name: 'SyntaxError' });
		});

		it('should return null since the file type has no implementation', () => {

			const output = apiSchemaBuilder._parseFile('test');

			assert.equal(output, null);
		});
	});

	describe('getSchemaPathsList', () => {

		it('should return a list of schema paths from tree', async () => {

			apiSchemaBuilder = new ApiSchemaBuilder();

			const moviesTreeMock = {
				nodes: {
					catalog: {
						nodes: {},
						schemas: ['catalog.yml']
					}
				},
				schemas: ['movie.yml', 'public.json']
			};

			const schemaPaths = apiSchemaBuilder._getSchemaPathsList(moviesTreeMock);

			assert.deepEqual(schemaPaths, ['movie.yml', 'public.json', 'catalog.yml']);
		});


	});

	describe('readSchemaFiles', () => {

		apiSchemaBuilder = new ApiSchemaBuilder();

		afterEach(() => {
			MockFs.restore();
		});

		it('should return a list of schema objects', async () => {

			MockFs({
				'base.yml': 'ping: pong',
				'public.json': '{ "ping": "pong" }'
			});

			const schemaPaths = ['base.yml', 'public.json'];

			const files = await apiSchemaBuilder._readSchemaFiles(schemaPaths);

			assert.deepEqual(files, [{ ping: 'pong' }, { ping: 'pong' }]);

		});

		it('should throw an error since it was unable to parse a file', async () => {

			MockFs({
				'base.yml': 'ping: pong',
				'public.json': '{ "ping" }'
			});

			const schemaPaths = ['base.yml', 'public.json'];

			await assert.rejects(apiSchemaBuilder._readSchemaFiles(schemaPaths));
		});
	});

	describe('validateSchema', () => {

		apiSchemaBuilder = new ApiSchemaBuilder();

		it('should validate the schema without errors', async () => {

			const schema = {
				openapi: '3.0.0',
				info: {
					title: 'Movie Api',
					version: '1.0.0'
				},
				tags: [],
				servers: [],
				paths: {}
			};

			await assert.doesNotReject(apiSchemaBuilder._validateSchema('public', schema));
		});

		it('should validate an invalid schema throwing an error and generating the log file', async () => {

			const fsMock = sandbox.mock(fs);

			// Avoids writing the file with the logs
			fsMock.expects('writeFile')
				.once()
				.returns();

			const schema = {
				openapi: 'test'
			};

			await assert.rejects(apiSchemaBuilder._validateSchema('public', schema));

			fsMock.restore();
		});

		it('should validate an invalid schema throwing an error and can not generating the log file', async () => {

			const fsMock = sandbox.mock(fs);

			// Avoids writing the file with the logs
			fsMock.expects('writeFile')
				.once()
				.rejects();

			const schema = {
				openapi: 'test'
			};

			await assert.rejects(apiSchemaBuilder._validateSchema('public', schema));

			fsMock.restore();
		});
	});

	describe('buildSchema', () => {

		let mock;
		let fsMock;

		apiSchemaBuilder = new ApiSchemaBuilder();

		const movieTreeMock = {
			nodes: {
				catalog: {
					nodes: {},
					schemas: ['list.yml']
				}
			},
			schemas: ['base.yml']
		};

		const movieSchemaPaths = [
			'movieApp/schemas/src/movie/base.yml',
			'movieApp/schemas/src/movie/catalog/list.yml'
		];

		const movieSchemaObjects = [
			{
				paths: {
					'/movie': {
						get: {
							responses: {
								200: {
									description: 'OK'
								}
							}
						}
					}
				}
			},
			{
				paths: {
					'/movie/catalog': {
						get: {
							responses: {
								200: {
									description: 'OK'
								},
								400: {
									description: 'Not Found'
								}
							}
						}
					}
				}
			}

		];

		const movieSchemaMerge = {
			paths: {
				'/movie': {
					get: {
						responses: {
							200: {
								description: 'Ok'
							}
						}
					}
				},
				'/movie/catalog': {
					get: {
						responses: {
							200: {
								description: 'Ok'
							},
							400: {
								description: 'Not Found'
							}
						}
					}
				}
			}
		};

		const movieSchemaResolved = {
			paths: {
				'/movie': {
					get: {
						responses: {
							200: {
								description: 'Ok'
							}
						}
					}
				},
				'/movie/catalog': {
					get: {
						responses: {
							200: {
								description: 'Ok'
							},
							400: {
								description: 'Not Found'
							}
						}
					}
				}
			}
		};

		beforeEach(() => {
			mock = sandbox.mock(apiSchemaBuilder);
			fsMock = sandbox.mock(fs);
		});


		afterEach(() => {
			sandbox.restore();
		});

		it('should build a schema and write the JSON file in the build output', async () => {

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(movieTreeMock)
				.returns(movieSchemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(movieSchemaPaths)
				.returns(movieSchemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(movieSchemaObjects)
				.returns(movieSchemaMerge);
			mock.expects('_validateSchema')
				.once()
				.withArgs('movie', movieSchemaResolved);
			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(movieSchemaResolved, null, '\t'))
				.returns();

			await assert.doesNotReject(apiSchemaBuilder._buildSchema('movie', movieTreeMock));
		});

		it('should reject if can not make the file', async () => {

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(movieTreeMock)
				.returns(movieSchemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(movieSchemaPaths)
				.returns(movieSchemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(movieSchemaObjects)
				.returns(movieSchemaMerge);
			mock.expects('_validateSchema')
				.once()
				.withArgs('movie', movieSchemaResolved);
			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(movieSchemaResolved, null, '\t'))
				.rejects();

			await assert.rejects(apiSchemaBuilder._buildSchema('movie', movieTreeMock));
		});

		it('should insert the ref if it\'s a json file', async () => {

			movieSchemaObjects[1].paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							$ref: '../content.json'
						}
					}
				}
			};
			movieSchemaMerge.paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							$ref: '../content.json'
						}
					}
				}
			};

			movieSchemaResolved.paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							type: 'string'
						}
					}
				}
			};

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(movieTreeMock)
				.returns(movieSchemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(movieSchemaPaths)
				.returns(movieSchemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(movieSchemaObjects)
				.returns(movieSchemaMerge);
			// Search de Refs
			fsMock.expects('readFile')
				.once()
				.callsFake((location, encoding, cb) => {
					if(location === `${ApiSchemaBuilder.schemaSrcDir}/content.json`)
						cb(undefined, { text: '{"type": "string"}' });
					else
						cb(new Error('fail'));
				});

			mock.expects('_validateSchema')
				.once()
				.withArgs('movie', movieSchemaResolved);

			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(movieSchemaResolved, null, '\t'))
				.returns();

			await assert.doesNotReject(apiSchemaBuilder._buildSchema('movie', movieTreeMock));

		});

		it('should insert the ref if it\'s a yml file', async () => {
			movieSchemaObjects[1].paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							$ref: '../content.yml'
						}
					}
				}
			};
			movieSchemaMerge.paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							$ref: '../content.yml'
						}
					}
				}
			};

			movieSchemaResolved.paths['/movie/catalog'].get.responses[200] = {
				content: {
					'application/json': {
						schema: {
							type: 'string'
						}
					}
				}
			};

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(movieTreeMock)
				.returns(movieSchemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(movieSchemaPaths)
				.returns(movieSchemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(movieSchemaObjects)
				.returns(movieSchemaMerge);
			// Search de Refs
			fsMock.expects('readFile')
				.once()
				.callsFake((location, encoding, cb) => {
					if(location === `${ApiSchemaBuilder.schemaSrcDir}/content.yml`)
						cb(undefined, { text: 'type: string' });
					else
						cb(new Error('fail'));
				});

			mock.expects('_validateSchema')
				.once()
				.withArgs('movie', movieSchemaResolved);

			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(movieSchemaResolved, null, '\t'))
				.returns();

			await assert.doesNotReject(apiSchemaBuilder._buildSchema('movie', movieTreeMock));

		});
	});

	describe('build', () => {

		apiSchemaBuilder = new ApiSchemaBuilder();
		let exit;

		beforeEach(() => {
			// Avoid showing messages in console during tests
			sandbox.stub(console, 'log').callsFake(() => true);
			sandbox.stub(console, 'error').callsFake(() => true);
			exit = sandbox.stub(process, 'exit');
		});

		afterEach(() => {
			sandbox.restore();
		});

		it('should build the schemas without errors', async () => {
			const mock = sandbox.mock(apiSchemaBuilder);

			const treeMock = {
				ipc: {
					nodes: {
						catalog: {
							nodes: {},
							schemas: ['catalog.yml']
						}
					},
					schemas: ['ipc.yml', 'base.json']
				},
				public: {
					nodes: {},
					schemas: ['public.yml', 'base.yml']
				}
			};

			mock.expects('_isDirectory').twice()
				.returns(true);

			mock.expects('_getSourceTree')
				.once()
				.returns(treeMock);
			const expectation1 = mock.expects('_buildSchema')
				.once()
				.withArgs('ipc', treeMock.ipc);
			const expectation2 = mock.expects('_buildSchema')
				.once()
				.withArgs('public', treeMock.public);

			await apiSchemaBuilder.build();

			mock.verify();
			expectation1.verify();
			expectation2.verify();
		});

		it('should do not build \'public.json\' but not rejects', async () => {

			const mock = sandbox.mock(apiSchemaBuilder);

			mock.expects('_isDirectory').twice()
				.returns(true);

			sandbox.stub(apiSchemaBuilder, '_getSourceTree').throws('test');
			const spyBuilder = sandbox.spy(apiSchemaBuilder, '_buildSchema');

			await apiSchemaBuilder.build();

			sandbox.assert.calledOnce(exit);
			sandbox.assert.calledWith(exit, -1);

			assert(spyBuilder.notCalled);
		});

		it('should do not build \'public.json\' but not rejects when no exists \'schemas/src\'', async () => {

			const mock = sandbox.mock(apiSchemaBuilder);

			mock.expects('_isDirectory')
				.once()
				.withArgs(ApiSchemaBuilder.schemaDir)
				.returns(true);

			mock.expects('_isDirectory')
				.once()
				.withArgs(ApiSchemaBuilder.schemaSrcDir)
				.returns(false);

			const spyBuilder = sandbox.spy(apiSchemaBuilder, '_buildSchema');

			await apiSchemaBuilder.build();

			sandbox.assert.calledOnce(exit);
			sandbox.assert.calledWith(exit, -1);

			assert(spyBuilder.notCalled);
		});

		it('should do not build \'public.json\' but not rejects when no exists \'schemas/\'', async () => {

			const spyBuilder = sandbox.spy(apiSchemaBuilder, '_buildSchema');

			await apiSchemaBuilder.build();

			sandbox.assert.calledOnce(exit);
			sandbox.assert.calledWith(exit, -1);

			assert(spyBuilder.notCalled);
		});

		it('should do not build \'public.json\' but not rejects when no files in \'schemas/src\'', async () => {

			const mock = sandbox.mock(apiSchemaBuilder);

			mock.expects('_isDirectory').twice()
				.returns(true);

			mock.expects('_getSourceTree').once()
				.returns({});

			mock.expects('_buildSchema').never();

			await apiSchemaBuilder.build();

			sandbox.assert.calledOnce(exit);
			sandbox.assert.calledWith(exit, -1);

			mock.verify();

		});
	});

});

describe('index', () => {

	before(() => {
		sandbox.stub(ApiSchemaBuilder.prototype, 'build');
	});

	after(() => {
		sandbox.restore();
	});

	it('should run the index script without problems', () => {
		const index = require('./../index'); // eslint-disable-line
	});

});
