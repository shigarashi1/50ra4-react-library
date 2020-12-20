import { omit, stringArray2EnumLikeObject } from '50ra4-library';
import { ActionsObservable, StateObservable } from 'redux-observable';
import { Subject } from 'rxjs';
// import { TestScheduler } from 'rxjs/testing';
import actionCreatorFactory, { Action } from 'typescript-fsa';
import { asyncCallbackAction, createAsyncCallbackActionEpics } from '../src';

type User = { id: string; name: string };
class UserError extends Error {
  name = 'UserError';
  constructor(message: string) {
    super(message);
  }
}
type State = null | User;

const asyncCallbackActionEpics = createAsyncCallbackActionEpics<State>();
const actionTypes = stringArray2EnumLikeObject([
  'onPrevious1',
  'onPrevious2',
  'onNext1',
  'onNext2',
  'onError1',
  'onError2',
  'onComplete1',
  'onComplete2',
]);
const actions = actionCreatorFactory('[asyncCallbackAction/test]');
const testActions = {
  onPrevious1: actions<void>(actionTypes.onPrevious1),
  onPrevious2: actions<void>(actionTypes.onPrevious2),
  onNext1: actions<User>(actionTypes.onNext1),
  onNext2: actions<void>(actionTypes.onNext2),
  onError1: actions<UserError>(actionTypes.onError1),
  onError2: actions<void>(actionTypes.onError2),
  onComplete1: actions<void>(actionTypes.onComplete1),
  onComplete2: actions<void>(actionTypes.onComplete2),
};
const USERS: User[] = [
  { id: '1', name: 'alice' },
  { id: '2', name: 'bob' },
];
const UserNotFoundErrorMessage = 'no found user';
const ActionExecuteType = '[50ra4-react-library/asyncCallbackAction]/execute';

const getUsername = async (userId: string) =>
  new Promise<User>((resolve, reject) => {
    setTimeout(() => {
      const user = USERS.find(({ id }) => id === userId);
      if (!user) {
        return reject(new UserError(UserNotFoundErrorMessage));
      }
      return resolve(user);
    }, 100);
  });

const TestActionProps = {
  onPrevious: [testActions.onPrevious1(), testActions.onPrevious2()],
  task: getUsername('1'),
  onNext: [(v: User) => testActions.onNext1(v), testActions.onNext2()],
  onError: [(v: UserError) => testActions.onError1(v), testActions.onError2()],
  onComplete: [testActions.onComplete1(), testActions.onComplete2()],
};
const TestActionFailedProps = { ...TestActionProps, task: getUsername('3') };

// FIXME: use testScheduler
class ActionTestScheduler {
  constructor(private readonly expectedActions: Action<any>[]) {}
  private count = 0;
  toEqual(actualAction: Action<any>) {
    expect(this.expectedActions[this.count]).toEqual(actualAction);
    this.count++;
  }
  get isEnd(): boolean {
    return this.count === this.expectedActions.length;
  }
}

describe('asyncCallbackAction', () => {
  it('previous', async (done) => {
    const executeAction = {
      type: ActionExecuteType,
      payload: omit(['onPrevious'], TestActionProps),
    };
    const scheduler = new ActionTestScheduler([testActions.onPrevious1(), testActions.onPrevious2(), executeAction]);
    const action$ = ActionsObservable.of(asyncCallbackAction(TestActionProps));
    const state$ = new StateObservable<State>(new Subject(), null);
    const dependencies = {};
    asyncCallbackActionEpics(action$, state$, dependencies).subscribe((actual) => {
      scheduler.toEqual(actual);
      if (scheduler.isEnd) {
        done();
      }
    });
  });
  describe('execute', () => {
    it('task success', async (done) => {
      const executeAction = {
        type: ActionExecuteType,
        payload: omit(['onPrevious'], TestActionProps),
      };
      const scheduler = new ActionTestScheduler([
        testActions.onNext1(USERS[0]),
        testActions.onNext2(),
        testActions.onComplete1(),
        testActions.onComplete2(),
      ]);
      const action$ = ActionsObservable.of(executeAction);
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      asyncCallbackActionEpics(action$, state$, dependencies).subscribe((actual) => {
        scheduler.toEqual(actual);
        if (scheduler.isEnd) {
          done();
        }
      });
    });
    it('task failed', async (done) => {
      const executeAction = {
        type: ActionExecuteType,
        payload: omit(['onPrevious'], TestActionFailedProps),
      };
      const scheduler = new ActionTestScheduler([
        testActions.onError1(new UserError(UserNotFoundErrorMessage)),
        testActions.onError2(),
        testActions.onComplete1(),
        testActions.onComplete2(),
      ]);
      const action$ = ActionsObservable.of(executeAction);
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      asyncCallbackActionEpics(action$, state$, dependencies).subscribe((actual) => {
        scheduler.toEqual(actual);
        if (scheduler.isEnd) {
          done();
        }
      });
    });
  });
});
