'use strict';

var sinon    = require('sinon');
var _        = require('lodash');
var expect   = require('chai').use(require('sinon-chai')).expect;
var Firebase = require('../').MockFirebase;

describe('MockFirebase', function() {
  var fb;

  beforeEach(function() {
    fb = new Firebase().child('data');
  });

  describe('#child', function () {

    it('can use leading slashes (#23)', function () {
      expect(fb.child('/children').currentPath).to.equal('Mock://data/children');
    });

    it('can use trailing slashes (#23)', function () {
      expect(fb.child('children/').currentPath).to.equal('Mock://data/children');
    });

  });

  describe('#set', function() {
    it('//todo');

    it('should remove old keys from data', function() {
      fb.autoFlush();
      fb.set({alpha: true, bravo: false});
      expect(fb.getData().a).equals(undefined);
    });

    it('should set priorities on children if included in data', function() {
      fb.autoFlush();
      fb.set({a: {'.priority': 100, '.value': 'a'}, b: {'.priority': 200, '.value': 'b'}});
      var dat = fb.getData();
      expect(dat.a).equals('a');
      expect(dat.b).equals('b');
      expect(fb.child('a').priority).equals(100);
      expect(fb.child('b').priority).equals(200);
    });

    it('should have correct priority in snapshot if added with set', function() {
      var spy = sinon.spy();
      fb.autoFlush();
      fb.on('child_added', spy);
      var count = spy.callCount;
      fb.set({alphanew: {'.priority': 100, '.value': 'a'}});
      expect(spy.callCount).equals(count+1);
      expect(spy.lastCall.args[0].getPriority()).equals(100);
    });

    it('child_added events should fire with correct prevChildName', function() {
      var data = {
        alpha: {'.priority': 200, foo: 'alpha'},
        bravo: {'.priority': 300, foo: 'bravo'},
        charlie: {'.priority': 100, foo: 'charlie'}
      };
      var expectedPrevChild = [null, 'charlie', 'alpha'];
      var spy = sinon.spy();
      fb = new Firebase('Empty://', null).autoFlush();
      fb.set(data);
      fb.on('child_added', spy);
      var count = spy.callCount;
      expect(count).equals(3);
      for(var i=0; i < count; i++) {
        var prevChildKey = spy.getCall(i).args[1];
        expect(prevChildKey).equals(expectedPrevChild[i]);
      }
    });

    it('child_added events should fire with correct priority', function() {
      var data = {
        alpha: {'.priority': 200, foo: 'alpha'},
        bravo: {'.priority': 300, foo: 'bravo'},
        charlie: {'.priority': 100, foo: 'charlie'}
      };
      var spy = sinon.spy();
      fb = new Firebase('Empty://', null).autoFlush();
      fb.set(data);
      fb.on('child_added', spy);
      var count = spy.callCount;
      expect(count).equals(3);
      for(var i=0; i < count; i++) {
        var snap = spy.getCall(i).args[0];
        var pri = data[snap.name()]['.priority'];
        expect(snap.getPriority()).equals(pri);
      }
    });

    it('should trigger child_removed if child keys are missing', function() {
      var spy = sinon.spy();
      fb.autoFlush();
      fb.on('child_removed', spy);
      var keys = Object.keys(fb.getData());
      var len = keys.length;
      // should not invoke callback yet
      expect(spy.callCount).equals(0);
      // data must have more than one record to do this test
      expect(len).above(1);
      // remove one key from data and call set()
      var dat = fb.getData();
      delete dat[keys[0]];
      fb.set(dat);
      expect(spy.callCount).equals(1);
    });

    it('should change parent from null to object when child is set', function() {
      fb.autoFlush();
      fb.set(null);
      fb.child('newkey').set({foo: 'bar'});
      expect(fb.getData()).eqls({newkey: {foo: 'bar'}});
    });
  });

  describe('#setPriority', function() {
    it('should trigger child_moved with correct prevChildName', function() {
      var spy = sinon.spy();
      fb.autoFlush();
      var keys = _.keys(fb.getData());
      expect(keys.length).above(1); // need 2 or more
      var firstKey = keys[0];
      var lastKey = keys.pop();
      fb.on('child_moved', spy);
      fb.child(firstKey).setPriority(250);
      expect(spy.callCount).equals(1);
      var call = spy.getCall(0);
      expect(call.args[1]).equals(lastKey);
    });

    it('should trigger a callback', function() {
      var spy = sinon.spy();
      fb.autoFlush();
      fb.setPriority(100, spy);
      expect(spy).to.have.been.called;
    });
  });

  describe('#setWithPriority', function() {
    it('should pass the priority to #setPriority', function() {
      fb.autoFlush();
      sinon.spy(fb, 'setPriority');
      fb.setWithPriority({}, 250);
      expect(fb.setPriority).to.have.been.calledWith(250);
    });

    it('should pass the data and callback to #set', function() {
      var data = {};
      var callback = sinon.spy();
      fb.autoFlush();
      sinon.spy(fb, 'set');
      fb.setWithPriority(data, 250, callback);
      expect(fb.set).to.have.been.calledWith(data, callback);
    });
  });

  describe('#remove', function() {
    it('//todo');

    it('should call child_removed for any children');

    it('should change to null if last child is removed');
  });

  describe('#on', function() {
    it('should work when initial value is null', function() {
      var spy = sinon.spy();
      fb.on('value', spy);
      fb.flush();
      expect(spy.callCount).equals(1);
      fb.set('foo');
      fb.flush();
      expect(spy.callCount).equals(2);
    });
  });

  describe('#transaction', function() {
    it('should call the transaction function', function(done) {
      fb.transaction(function() {
        done();
      });
      fb.flush();
    });
    it('should fire the callback with a "committed" boolean and error message', function(done) {
      fb.transaction(function(currentValue) {
        currentValue.transacted = 'yes';
        return currentValue;
      }, function(error, committed, snapshot) {
        expect(error).equals(null);
        expect(committed).equals(true);
        expect(snapshot.val().transacted).equals('yes');
        done();
      });
      fb.flush();
    });
  });

  describe('#auth', function() {
    it('should allow fail auth for invalid token', function(done) {
      fb.failNext('auth', new Error('INVALID_TOKEN'));
      fb.auth('invalidToken', function(error, result) {
        expect(error.message).equals('INVALID_TOKEN');
        done();
      });
      fb.flush();
    });

    it('should allow auth for any other token and return expires at', function(done) {
      fb.auth('goodToken', function(error, result) {
        expect(error).equals(null);
        expect(result.auth !== null).equals(true);
        expect(result.expires !== null).equals(true);
        done();
      });
      fb.flush();
    });
  });
});
