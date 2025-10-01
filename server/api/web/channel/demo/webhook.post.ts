export default defineEventHandler(async event => {
  const body = await readBody<Body>(event);
  return {
    code: 0,
    data: body,
  };
});
