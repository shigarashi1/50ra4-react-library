import { omit, stringArray2EnumLikeObject } from '50ra4-library';
import { ActionsObservable, StateObservable } from 'redux-observable';
import { Subject } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { toArray } from 'rxjs/operators';
import actionCreatorFactory from 'typescript-fsa';
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
  'onCompleted1',
  'onCompleted2',
]);
const actions = actionCreatorFactory('[asyncCallbackAction/test]');
const testActions = {
  onPrevious1: actions<void>(actionTypes.onPrevious1),
  onPrevious2: actions<void>(actionTypes.onPrevious2),
  onNext1: actions<User>(actionTypes.onNext1),
  onNext2: actions<void>(actionTypes.onNext2),
  onError1: actions<UserError>(actionTypes.onError1),
  onError2: actions<void>(actionTypes.onError2),
  onCompleted1: actions<void>(actionTypes.onCompleted1),
  onCompleted2: actions<void>(actionTypes.onCompleted2),
};
const USERS: User[] = [
  { id: '1', name: 'alice' },
  { id: '2', name: 'bob' },
];
const UserNotFoundErrorMessage = 'NOT FOUND USER';
const ActionExecuteType = '[50ra4-react-library/asyncCallbackAction]/execute';

const getUsername = async (userId: string) =>
  new Promise<User>((resolve, reject) => {
    setTimeout(() => {
      const user = USERS.find(({ id }) => id === userId);
      if (!user) {
        return reject(new UserError(UserNotFoundErrorMessage));
      }
      return resolve(user);
    }, 50);
  });

const TestActionProps = {
  onPrevious: [testActions.onPrevious1(), testActions.onPrevious2()],
  task: getUsername('1'),
  onNext: [(v: User) => testActions.onNext1(v), testActions.onNext2()],
  onError: [(v: UserError) => testActions.onError1(v), testActions.onError2()],
  onCompleted: [testActions.onCompleted1(), testActions.onCompleted2()],
};
const TestActionFailedProps = { ...TestActionProps, task: getUsername('3') };

describe('asyncCallbackAction', () => {
  // FIXME: use TestScheduler
  let testScheduler: TestScheduler;

  beforeEach(() => {
    jest.resetModules();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    testScheduler.flush();
  });

  it.skip('should use TestScheduler', () => {
    testScheduler.run(({ cold, expectObservable }) => {
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      const values = {
        a: asyncCallbackAction(TestActionProps),
        b: testActions.onPrevious1(),
        c: testActions.onPrevious2(),
        d: {
          type: ActionExecuteType,
          payload: omit(['onPrevious'], TestActionProps),
        },
      };
      const input$ = 'a';
      const expect = 'bcd';
      const test$ = asyncCallbackActionEpics(
        new ActionsObservable(cold(input$, values)), //
        state$,
        dependencies,
      );
      expectObservable(test$).toBe(expect, values);
    });
  });

  describe('previous', () => {
    it('should return "onPrevious" and "execute" Actions', async (done) => {
      const action$ = ActionsObservable.of(asyncCallbackAction(TestActionProps));
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      asyncCallbackActionEpics(action$, state$, dependencies)
        .pipe(toArray())
        .subscribe((actual) => {
          expect(actual).toEqual([
            testActions.onPrevious1(),
            testActions.onPrevious2(),
            {
              type: ActionExecuteType,
              payload: omit(['onPrevious'], TestActionProps),
            },
          ]);
          done();
        });
    });
  });
  describe('execute', () => {
    it('should return "onNext" and "onCompleted" Actions when task success', async (done) => {
      const action$ = ActionsObservable.of({
        type: ActionExecuteType,
        payload: omit(['onPrevious'], TestActionProps),
      });
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      asyncCallbackActionEpics(action$, state$, dependencies)
        .pipe(toArray())
        .subscribe((actual) => {
          expect(actual).toEqual([
            testActions.onNext1(USERS[0]),
            testActions.onNext2(),
            testActions.onCompleted1(),
            testActions.onCompleted2(),
          ]);
          done();
        });
    });
    it('should return "onError" and "onCompleted" Actions when task fails', async (done) => {
      const action$ = ActionsObservable.of({
        type: ActionExecuteType,
        payload: omit(['onPrevious'], TestActionFailedProps),
      });
      const state$ = new StateObservable<State>(new Subject(), null);
      const dependencies = {};
      asyncCallbackActionEpics(action$, state$, dependencies)
        .pipe(toArray())
        .subscribe((actual) => {
          expect(actual).toEqual([
            testActions.onError1(new UserError(UserNotFoundErrorMessage)),
            testActions.onError2(),
            testActions.onCompleted1(),
            testActions.onCompleted2(),
          ]);
          done();
        });
    });
  });
});
