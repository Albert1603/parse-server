import { ParsePubSub } from './ParsePubSub';
import Parse from 'parse/node';
import logger from '../logger';

class ParseCloudCodePublisher {
  parsePublisher: Object;

  // config object of the publisher, right now it only contains the redisURL,
  // but we may extend it later.
  constructor(config: any = {}) {
    this.parsePublisher = ParsePubSub.createPublisher(config);
  }

  async connect() {
    if (typeof this.parsePublisher.connect === 'function') {
      if (this.parsePublisher.isOpen) {
        return;
      }
      return Promise.resolve(this.parsePublisher.connect());
    }
  }

  async shutdown() {
    // The in-memory publisher has no connection to close
    if (typeof this.parsePublisher.close !== 'function' || !this.parsePublisher.isOpen) {
      return;
    }
    try {
      await this.parsePublisher.close();
    } catch (error) {
      logger.error('LiveQuery publisher error on shutdown', { error });
    }
  }

  onCloudCodeAfterSave(request: any): void {
    this._onCloudCodeMessage(Parse.applicationId + 'afterSave', request);
  }

  onCloudCodeAfterDelete(request: any): void {
    this._onCloudCodeMessage(Parse.applicationId + 'afterDelete', request);
  }

  onClearCachedRoles(user: Parse.Object) {
    this._publish(Parse.applicationId + 'clearCache', JSON.stringify({ userId: user.id }));
  }

  // A Redis publisher rejects once it is closed, e.g. for an afterSave that completes during
  // shutdown; the error is logged instead of becoming an unhandled rejection
  _publish(channel: string, message: string): void {
    Promise.resolve(this.parsePublisher.publish(channel, message)).catch(error => {
      logger.error('LiveQuery publisher error', { error });
    });
  }

  // Request is the request object from cloud code functions. request.object is a ParseObject.
  _onCloudCodeMessage(type: string, request: any): void {
    logger.verbose(
      'Raw request from cloud code current : %j | original : %j',
      request.object,
      request.original
    );
    // We need the full JSON which includes className
    const message = {
      currentParseObject: request.object._toFullJSON(),
    };
    if (request.original) {
      message.originalParseObject = request.original._toFullJSON();
    }
    if (request.classLevelPermissions) {
      message.classLevelPermissions = request.classLevelPermissions;
    }
    this._publish(type, JSON.stringify(message));
  }
}

export { ParseCloudCodePublisher };
