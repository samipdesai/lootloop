// Unit tests for the account-deletion service (task #52). Unlike the other
// service tests (which hit the live stack), these MOCK the backend boundary —
// `client.functions.invoke` — because the wrappers' whole job is to call the
// `delete-account` Edge Function with the right name + body and pass the result
// through. (The function's real behavior is covered end-to-end by
// supabase/functions/delete-account/run-tests.mjs.)
import { leaveFamily, deleteFamily, type LootLoopClient } from './index';

function mockClient(result: unknown) {
  const invoke = jest.fn().mockResolvedValue(result);
  // Only `functions.invoke` is exercised; cast through unknown for the rest.
  const client = { functions: { invoke } } as unknown as LootLoopClient;
  return { client, invoke };
}

test('leaveFamily invokes delete-account with action "leave" and returns the result', async () => {
  const ok = { data: { ok: true, action: 'leave', deleted_users: 1 }, error: null };
  const { client, invoke } = mockClient(ok);

  const res = await leaveFamily(client);

  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith('delete-account', { body: { action: 'leave' } });
  expect(res).toBe(ok);
});

test('deleteFamily invokes delete-account with action "delete_family" and returns the result', async () => {
  const ok = { data: { ok: true, action: 'delete_family', deleted_users: 2 }, error: null };
  const { client, invoke } = mockClient(ok);

  const res = await deleteFamily(client);

  expect(invoke).toHaveBeenCalledTimes(1);
  expect(invoke).toHaveBeenCalledWith('delete-account', { body: { action: 'delete_family' } });
  expect(res).toBe(ok);
});

test('an Edge Function error (e.g. last_parent / non-parent) is passed through', async () => {
  const errResult = { data: null, error: { name: 'FunctionsHttpError', message: 'boom' } };
  const { client } = mockClient(errResult);

  const res = await leaveFamily(client);

  expect(res.error).toEqual({ name: 'FunctionsHttpError', message: 'boom' });
  expect(res.data).toBeNull();
});
