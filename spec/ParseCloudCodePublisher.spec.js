const ParseCloudCodePublisher = require('../lib/LiveQuery/ParseCloudCodePublisher')
  .ParseCloudCodePublisher;
const Parse = require('parse/node');

describe('ParseCloudCodePublisher', function () {
  beforeEach(function (done) {
    // Mock ParsePubSub
    const mockParsePubSub = {
      createPublisher: jasmine.createSpy('publish').and.returnValue({
        publish: jasmine.createSpy('publish'),
        on: jasmine.createSpy('on'),
      }),
      createSubscriber: jasmine.createSpy('publish').and.returnValue({
        subscribe: jasmine.createSpy('subscribe'),
        on: jasmine.createSpy('on'),
      }),
    };
    jasmine.mockLibrary('../lib/LiveQuery/ParsePubSub', 'ParsePubSub', mockParsePubSub);
    done();
  });

  it('can initialize', function () {
    const config = {};
    new ParseCloudCodePublisher(config);

    const ParsePubSub = require('../lib/LiveQuery/ParsePubSub').ParsePubSub;
    expect(ParsePubSub.createPublisher).toHaveBeenCalledWith(config);
  });

  it('can handle cloud code afterSave request', function () {
    const publisher = new ParseCloudCodePublisher({});
    publisher._onCloudCodeMessage = jasmine.createSpy('onCloudCodeMessage');
    const request = {};
    publisher.onCloudCodeAfterSave(request);

    expect(publisher._onCloudCodeMessage).toHaveBeenCalledWith(
      Parse.applicationId + 'afterSave',
      request
    );
  });

  it('can handle cloud code afterDelete request', function () {
    const publisher = new ParseCloudCodePublisher({});
    publisher._onCloudCodeMessage = jasmine.createSpy('onCloudCodeMessage');
    const request = {};
    publisher.onCloudCodeAfterDelete(request);

    expect(publisher._onCloudCodeMessage).toHaveBeenCalledWith(
      Parse.applicationId + 'afterDelete',
      request
    );
  });

  it('can handle cloud code request', function () {
    const publisher = new ParseCloudCodePublisher({});
    const currentParseObject = new Parse.Object('Test');
    currentParseObject.set('key', 'value');
    const originalParseObject = new Parse.Object('Test');
    originalParseObject.set('key', 'originalValue');
    const request = {
      object: currentParseObject,
      original: originalParseObject,
    };
    publisher._onCloudCodeMessage('afterSave', request);

    const args = publisher.parsePublisher.publish.calls.mostRecent().args;
    expect(args[0]).toBe('afterSave');
    const message = JSON.parse(args[1]);
    expect(message.currentParseObject).toEqual(request.object._toFullJSON());
    expect(message.originalParseObject).toEqual(request.original._toFullJSON());
  });

  it('logs an error if publishing fails', async () => {
    const logger = require('../lib/logger').default;
    const loggerErrorSpy = spyOn(logger, 'error');
    const publisher = new ParseCloudCodePublisher({});
    const error = new Error('The client is closed');
    publisher.parsePublisher.publish.and.rejectWith(error);
    publisher._onCloudCodeMessage('afterSave', { object: new Parse.Object('Test') });
    await new Promise(resolve => setImmediate(resolve));

    expect(loggerErrorSpy).toHaveBeenCalledWith('LiveQuery publisher error', { error });
  });

  it('can shutdown an open publisher', async () => {
    const publisher = new ParseCloudCodePublisher({});
    publisher.parsePublisher.isOpen = true;
    publisher.parsePublisher.close = jasmine.createSpy('close').and.resolveTo();
    await publisher.shutdown();

    expect(publisher.parsePublisher.close).toHaveBeenCalledTimes(1);
  });

  it('does not close a publisher that is not open', async () => {
    const publisher = new ParseCloudCodePublisher({});
    publisher.parsePublisher.isOpen = false;
    publisher.parsePublisher.close = jasmine.createSpy('close').and.resolveTo();
    await publisher.shutdown();

    expect(publisher.parsePublisher.close).not.toHaveBeenCalled();
  });

  it('can shutdown a publisher without connection', async () => {
    const publisher = new ParseCloudCodePublisher({});

    await expectAsync(publisher.shutdown()).toBeResolved();
  });

  it('logs an error if the publisher fails to close', async () => {
    const logger = require('../lib/logger').default;
    const loggerErrorSpy = spyOn(logger, 'error');
    const publisher = new ParseCloudCodePublisher({});
    const error = new Error('close failed');
    publisher.parsePublisher.isOpen = true;
    publisher.parsePublisher.close = jasmine.createSpy('close').and.rejectWith(error);

    await expectAsync(publisher.shutdown()).toBeResolved();
    expect(loggerErrorSpy).toHaveBeenCalledWith('LiveQuery publisher error on shutdown', { error });
  });

  afterEach(function () {
    jasmine.restoreLibrary('../lib/LiveQuery/ParsePubSub', 'ParsePubSub');
  });
});
