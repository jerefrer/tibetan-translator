import $ from 'jquery'
import _ from 'underscore'
import { v4 as uuid } from 'uuid'

const EventHandlers = {

  handlers: [],

  add(options) {
    // If an id is provided and a handler with that id already exists, don't add duplicate
    if (options.id && this.handlers.some(h => h.id === options.id)) {
      return this.handlers.find(h => h.id === options.id);
    }
    var handler = _(options).defaults({
      id: uuid(),
      active: true,
    });
    this.handlers.push(handler);
    return handler;
  },

  enable (id) {
    _.chain(this.handlers).where({id: id}).each((handler) => handler.active = true);
  },

  disable (id) {
    _.chain(this.handlers).where({id: id}).each((handler) => handler.active = false);
  },

  remove(id) {
    this.handlers = _(this.handlers).reject((handler) => handler.id == id);
    return true;
  },

  install () {
    _(['keyup', 'keydown', 'keypress', 'visibilitychange', 'resize', 'scroll']).each((type) => {
      $(window).on(type, (event) => {
        var events = _(this.handlers).where({type: type, active: true});
        _(events).each((e) => e.callback(event));
      });
    });
  }

}

EventHandlers.install();

export default EventHandlers;