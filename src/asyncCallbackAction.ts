/* eslint-disable @typescript-eslint/no-explicit-any */
import { actionCreatorFactory, Action, AnyAction } from 'typescript-fsa';
import { Epic, combineEpics } from 'redux-observable';
import { ofAction } from 'typescript-fsa-redux-observable-of-action';
import { mergeMap, concatMap } from 'rxjs/operators';
import { Observable, isObservable } from 'rxjs';
import { stringArray2EnumLikeObject } from '50ra4-library';

type ReturnActionFunction<T> = (args: T) => Action<any>;
type AsyncActionNext<T> = Array<Action<any> | ReturnActionFunction<T>>;
export type AsyncActionProps<T> = {
  onPrevious?: Action<any>[];
  task: Promise<T> | Observable<T>;
  onNext?: AsyncActionNext<T>;
  onError?: AsyncActionNext<any>;
  onCompleted?: Action<any>[];
};

const toActions = (result: any, nextArray: AsyncActionNext<any> = []): Action<any>[] =>
  nextArray.map((next) => (typeof next === 'function' ? next(result) : next));

const actions = actionCreatorFactory('[50ra4-react-library/asyncCallbackAction]');
const actionType = stringArray2EnumLikeObject(['previous', 'execute']);
const previousAction = actions<AsyncActionProps<any>>(actionType.previous);
const executeAction = actions<Omit<AsyncActionProps<any>, 'onPrevious'>>(actionType.execute);

const previousEpic = <State>(): Epic<AnyAction, Action<any>, State> => (action$) =>
  action$.pipe(
    ofAction(previousAction),
    concatMap(({ payload }) => {
      const { onPrevious, ...rest } = payload;
      const previousActions = onPrevious || [];
      return [...previousActions, executeAction(rest)];
    }),
  );

const executeEpic = <State>(): Epic<AnyAction, Action<any>, State> => (action$) =>
  action$.pipe(
    ofAction(executeAction),
    mergeMap(async ({ payload }) => {
      const { task, ...rest } = payload;
      const asyncFn = isObservable(task) ? task.toPromise() : task;
      const result = await asyncFn.catch((err) => err);
      return { result, payload: rest };
    }),
    concatMap(({ result, payload }) => {
      const { onCompleted, onError, onNext } = payload;
      const completeActions = onCompleted || [];
      if (result instanceof Error) {
        return [...toActions(result, onError), ...completeActions];
      }
      return [...toActions(result, onNext), ...completeActions];
    }),
  );

export const asyncCallbackAction = <T>(props: AsyncActionProps<T>) => previousAction(props);
export const createAsyncCallbackActionEpics = <State = any>() =>
  combineEpics(previousEpic<State>(), executeEpic<State>());
