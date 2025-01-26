const osjs = require('osjs');
const path = require('path');
const stream = require('stream');
const systemAdapter = require('../../../src/adapters/vfs/system.js');

describe('VFS System adapter', () => {
  let core;
  let adapter;

  beforeAll(() => osjs().then(c => {
    core = c;
    adapter = systemAdapter(core);
  }));

  afterAll(() => core.destroy());

  const vfs = {
    mount: {
      name: 'home',
      root: 'home:/',
      attributes: {
        root: '{vfs}/{username}'
      }
    }
  };

  const createOptions = (options = {}) => ({
    ...options,
    session: {
      user: {
        username: 'jest'
      }
    }
  });

  const request = (name, ...args) => adapter[name](vfs, vfs)(...args);

  test('#capabilities', () => {
    return expect(request('capabilities', '', createOptions()))
      .resolves
      .toMatchObject({
        pagination: false,
        sort: false,
      });
  });

  test('#touch', () => {
    return expect(request('touch', 'home:/test', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#stat', () => {
    const realPath = path.join(core.configuration.tempPath, 'jest/test');

    return expect(request('stat', 'home:/test', createOptions()))
      .resolves
      .toMatchObject({
        filename: 'test',
        path: realPath,
        size: 0,
        isFile: true,
        isDirectory: false,
        mime: 'application/octet-stream'
      });
  });

  test('#copy', () => {
    return expect(request('copy', 'home:/test', 'home:/test-copy', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#rename', () => {
    return expect(request('rename', 'home:/test-copy', 'home:/test-rename', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#mkdir', () => {
    return expect(request('mkdir', 'home:/test-directory', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#mkdir - existing directory', () => {
    return expect(request('mkdir', 'home:/test-directory', createOptions()))
      .rejects
      .toThrowError();
  });

  test('#mkdir - ensure', () => {
    return expect(request('mkdir', 'home:/test-directory', createOptions({ensure: true})))
      .resolves
      .toBe(true);
  });

  test('#readfile', () => {
    return expect(request('readfile', 'home:/test', createOptions()))
      .resolves
      .toBeInstanceOf(stream.Readable);
  });

  test('#writefile', () => {
    const s = new stream.Readable();
    s._read = () => {};
    s.push('jest');
    s.push(null);

    return expect(request('writefile', 'home:/test', s, createOptions()))
      .resolves
      .toBe(true);
  });

  test('#exists - existing file', () => {
    return expect(request('exists', 'home:/test-rename', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#exists - existing directory', () => {
    return expect(request('exists', 'home:/test-directory', createOptions()))
      .resolves
      .toBe(true);
  });

  test('#exists - non existing file', () => {
    return expect(request('exists', 'home:/test-copy', createOptions()))
      .resolves
      .toBe(false);
  });

  test('#search', () => {
    return expect(request('search', 'home:/', '*', createOptions()))
      .resolves
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test',
            isFile: true
          }),
          expect.objectContaining({
            filename: 'test-rename',
            isFile: true
          })
        ])
      );
  });

  test('#readdir', () => {
    return expect(request('readdir', 'home:/', createOptions()))
      .resolves
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'test-directory',
            isDirectory: true
          }),
          expect.objectContaining({
            filename: 'test',
            isFile: true
          }),
          expect.objectContaining({
            filename: 'test-rename',
            isFile: true
          })
        ])
      );
  });

  test('#realpath', () => {
    const realPath = path.join(core.configuration.tempPath, 'jest/test');

    return expect(request('realpath', 'home:/test', createOptions()))
      .resolves
      .toBe(realPath);
  });

  test('#archive - compress files', async () => {
    const options = createOptions({action: 'compress'});

    // Compress the files
    await expect(
      request('archive', ['home:/test', 'home:/test-rename'], options)
    ).resolves.toBe(true);

    // Ensure the zip file exists
    await expect(
      request('exists', 'home:/test.zip', createOptions())
    ).resolves.toBe(true);
  });

  test('#archive - compress directory', async () => {
    const options = createOptions({action: 'compress'});

    // Compress the directory
    await expect(
      request('archive', ['home:/test-directory'], options)
    ).resolves.toBe(true);

    // Ensure the zip file exists
    await expect(
      request('exists', 'home:/test-directory.zip', createOptions())
    ).resolves.toBe(true);
  });

  test('#archive - compress error', () => {
    const options = createOptions({action: 'compress'});

    return expect(
      request('archive', ['home:/fakefile.php'], options)
    ).rejects.toThrowError();
  });

  test('#archive - extract', async () => {
    const options = createOptions({action: 'extract'});

    // Extract the archive
    await expect(
      request('archive', ['home:/test.zip'], options)
    ).resolves.toBe(true);

    // Ensure a folder was created for the extracted files
    await expect(
      request('exists', 'home:/test', createOptions())
    ).resolves.toBe(true);

    // Check the contents of the directory
    const extractedFiles = await request('readdir', 'home:/test', createOptions());
    expect(extractedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({filename: 'test', isFile: true}),
        expect.objectContaining({filename: 'test-rename', isFile: true}),
      ])
    );

    // Ensure the contents of the files are the same
    const extractedFileContents = await fs.readFile(path.join(core.config('tempPath'), 'jest/test/test'), 'utf8');
    expect(extractedFileContents).toBe('jest');

    const extractedEmptyFileContents = await fs.readFile(path.join(core.config('tempPath'), 'jest/test/test-rename'), 'utf8');
    expect(extractedEmptyFileContents).toBe('');
  });

  test('#archive - extract error', () => {
    const options = createOptions({action: 'extract'});

    return expect(
      request('archive', ['home:/fakefile.php'], options)
    ).rejects.toThrowError();
  });

  test('#archive - bad option', () => {
    const options = createOptions({action: 'fake'});

    return expect(
      request('archive', ['home:/text.txt.zip'], options)
    ).rejects.toThrowError();
  });

  test('#unlink - files', () => {
    const files = ['home:/test.zip', 'home:/test/test', 'home:/test/test-rename'];

    return Promise.all(
      files.map((file) => {
        return expect(request('unlink', file, createOptions())).resolves.toBe(
          true
        );
      })
    );
  });

  test('#unlink - folders', () => {
    const directories = ['home:/test-directory', 'home:/test'];

    return Promise.all(
      directories.map((dir) => {
        return expect(request('unlink', dir, createOptions())).resolves.toBe(true);
      })
    );
  });
});
