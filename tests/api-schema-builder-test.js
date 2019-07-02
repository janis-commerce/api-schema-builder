'use strict';

const assert = require('assert');
const sandbox = require('sinon').createSandbox();
const path = require('path');
const MockFs = require('mock-fs');
const fs = require('fs');

const { ApiSchemaBuilder } = require('./../lib');

const fakeBaseYML = `
openapi: 3.0.0
info:
  title: Fake Core
  description: This methods are availables in every microservice
  version: 1.0.0
tags:
  - name: CORE
    description: Core apis
servers:
  - url: 'https://www.fake.com/'
    description: The Most Fake API
    variables:
      basePath:
        default: api
      environment:
        default: fake

paths: {}
`;

before(() => {
	// Avoid showing messages in console during tests
	// sandbox.stub(console, 'log').callsFake(() => true);
	// sandbox.stub(console, 'error').callsFake(() => true);
});

after(() => {
	sandbox.restore();
	MockFs.restore();
});


describe('ApiSchemaBuilder', () => {


	describe('isDirectory', () => {

		context('when directories and files exist', () => {
			let apiSchemaBuilder;
			let directory;

			before(() => {
				MockFs({
					schemas: {
						src: {
							'base.yml': fakeBaseYML,
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

			let apiSchemaBuilder;
			let directory;

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
				directory = path.join(ApiSchemaBuilder.schemaSrcDir, 'build.yml');

				assert(!await apiSchemaBuilder._isDirectory(directory));
			});
		});

	});

	describe('mergeSchemas', () => {
		const apiSchemaBuilder = new ApiSchemaBuilder();

		it('should merge a list of objects into a single object', () => {

			const obj1 = { obj1: 'obj1' };
			const obj2 = { obj2: 'obj2' };
			const obj3 = { obj3: 'obj3' };

			const merge = apiSchemaBuilder._mergeSchemas([obj1, obj2, obj3]);

			assert.deepEqual(merge, { ...obj1, ...obj2, ...obj3 });
		});

		it('should throw error if nothing to merge', () => {

			assert.throws(() => apiSchemaBuilder._mergeSchemas());
		});
	});

	describe('parseFile', () => {

		const apiSchemaBuilder = new ApiSchemaBuilder();

		it('should return an object from a yml string', () => {

			const object = apiSchemaBuilder._parseFile('yml', 'foo: bar');

			assert.deepEqual(object, { foo: 'bar' });
		});

		it('should return an object from a yaml string', () => {

			const object = apiSchemaBuilder._parseFile('yaml', 'foo: bar');

			assert.deepEqual(object, { foo: 'bar' });
		});

		it('should return an object from a JSON string', () => {

			const object = apiSchemaBuilder._parseFile('json', '{ "foo": "bar" }');

			assert.deepEqual(object, { foo: 'bar' });
		});

		it('should throw a SyntaxError from an invalid yml file', () => {

			assert.throws(() => apiSchemaBuilder._parseFile('yml', 'foo & bar\n\ttest'), { name: 'SyntaxError' });
		});

		it('should return null since the file type has no implementation', () => {

			const output = apiSchemaBuilder._parseFile('test');

			assert.equal(output, null);
		});
	});

	describe('getSchemaPathsList', () => {

		it('should return a list of schema paths from tree', async () => {

			const apiSchemaBuilder = new ApiSchemaBuilder();

			const IPCTreeMock = {
				nodes: {
					catalog: {
						nodes: {},
						schemas: ['catalog.yml']
					}
				},
				schemas: ['ipc.yml', 'base.json']
			};

			const schemaPaths = apiSchemaBuilder._getSchemaPathsList(IPCTreeMock);

			assert.deepEqual(schemaPaths, ['ipc.yml', 'base.json', 'catalog.yml']);
		});


	});

	describe('readSchemaFiles', () => {

		const apiSchemaBuilder = new ApiSchemaBuilder();

		afterEach(() => {
			MockFs.restore();
		});

		it('should return a list of schema objects', async () => {

			MockFs({
				'base.yml': 'foo: bar',
				'base.json': '{ "foo": "bar" }'
			});

			const schemaPaths = ['base.yml', 'base.json'];

			const files = await apiSchemaBuilder._readSchemaFiles(schemaPaths);

			assert.deepEqual(files, [{ foo: 'bar' }, { foo: 'bar' }]);

		});

		it('should throw an error since it was unable to parse a file', async () => {

			MockFs({
				'base.yml': 'foo: bar',
				'base.json': '{ "foo" }'
			});

			const schemaPaths = ['ipc.yml', 'base.json'];

			await assert.rejects(apiSchemaBuilder._readSchemaFiles(schemaPaths));
		});
	});


	describe('validateSchema', () => {

		const apiSchemaBuilder = new ApiSchemaBuilder();

		it('should validate the schema without errors', async () => {

			const schema = {
				openapi: '3.0.0',
				info: {
					title: 'test',
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

		const apiSchemaBuilder = new ApiSchemaBuilder();

		afterEach(() => {
			sandbox.restore();
		});

		it('should build a schema and write the JSON file in the build output', async () => {

			const mock = sandbox.mock(apiSchemaBuilder);
			const fsMock = sandbox.mock(fs);
			const IPCTreeMock = {
				nodes: {
					catalog: {
						nodes: {},
						schemas: ['catalog.yml']
					}
				},
				schemas: ['ipc.yml', 'base.json']
			};
			const schemaPaths = ['ipc.yml', 'base.json', 'catalog.yml'];
			const schemaObjects = [{ obj1: 'obj1' }, { obj2: 'obj2' }, { obj3: 'obj3' }];
			const schemaMerge = schemaObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(IPCTreeMock)
				.returns(schemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(schemaPaths)
				.returns(schemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(schemaObjects)
				.returns(schemaMerge);
			mock.expects('_validateSchema')
				.once()
				.withArgs('ipc', schemaMerge);
			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(schemaMerge, null, '\t'))
				.returns();

			await assert.doesNotReject(apiSchemaBuilder._buildSchema('ipc', IPCTreeMock));
		});

		it('should reject if can not make the file', async () => {

			const mock = sandbox.mock(apiSchemaBuilder);
			const fsMock = sandbox.mock(fs);
			const IPCTreeMock = {
				nodes: {
					catalog: {
						nodes: {},
						schemas: ['catalog.yml']
					}
				},
				schemas: ['ipc.yml', 'base.json']
			};
			const schemaPaths = ['ipc.yml', 'base.json', 'catalog.yml'];
			const schemaObjects = [{ obj1: 'obj1' }, { obj2: 'obj2' }, { obj3: 'obj3' }];
			const schemaMerge = schemaObjects.reduce((acc, obj) => ({ ...acc, ...obj }), {});

			mock.expects('_getSchemaPathsList')
				.once()
				.withArgs(IPCTreeMock)
				.returns(schemaPaths);
			mock.expects('_readSchemaFiles')
				.once()
				.withArgs(schemaPaths)
				.returns(schemaObjects);
			mock.expects('_mergeSchemas')
				.once()
				.withArgs(schemaObjects)
				.returns(schemaMerge);
			mock.expects('_validateSchema')
				.once()
				.withArgs('ipc', schemaMerge);
			fsMock.expects('existsSync')
				.once()
				.returns(false);
			fsMock.expects('mkdir')
				.never();
			fsMock.expects('writeFile')
				.once()
				.withArgs(`${ApiSchemaBuilder.buildFile}`, JSON.stringify(schemaMerge, null, '\t'))
				.rejects();

			await assert.rejects(apiSchemaBuilder._buildSchema('ipc', IPCTreeMock));
		});
	});

	describe('build', () => {

		const apiSchemaBuilder = new ApiSchemaBuilder();

		beforeEach(() => {
			// Avoid showing messages in console during tests
			sandbox.stub(console, 'log').callsFake(() => true);
			sandbox.stub(console, 'error').callsFake(() => true);
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

			assert(spyBuilder.notCalled);
		});

		it('should do not build \'public.json\' but not rejects when no exists \'schemas/\'', async () => {

			const spyBuilder = sandbox.spy(apiSchemaBuilder, '_buildSchema');

			await apiSchemaBuilder.build();

			assert(spyBuilder.notCalled);
		});
	});

	describe('getSourceTree', () => {


		const baseFile = path.join(ApiSchemaBuilder.schemaSrcDir, 'public', 'base.yml');

		const apiSchemaBuilder = new ApiSchemaBuilder();

		before(() => {
			MockFs({
				schemas: {
					src: {
						public: {
							sku: {
								item: {}
							},
							'base.yml': 'FakeApi: true'
						},
						'public.json': '{ "Api" : "Fake" }'
					}
				}
			});
		});

		after(() => {
			sandbox.restore();
			MockFs.restore();
		});

		it('should return the correct tree object, ignoring the \'public.json\' ', async () => {

			const treeExpected = {
				public: {
					nodes: {
						sku: {
							nodes: {
								item: {
									nodes: {},
									schemas: []
								}
							},
							schemas: []
						}
					},
					schemas: [baseFile]
				}
			};
			const tree = await apiSchemaBuilder._getSourceTree();

			assert.deepEqual(tree, treeExpected);
		});


		it('should reject when directory is not a base directory ', async () => {

			await assert.rejects(apiSchemaBuilder._getSourceTree(baseFile));
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
