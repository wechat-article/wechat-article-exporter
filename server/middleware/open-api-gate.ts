import {
  createOpenApiDisabledBody,
  isOpenApiEnabled,
  isPublicOpenApiPath,
} from '~/server/utils/open-api-gate';

export default defineEventHandler(event => {
  const pathname = getRequestURL(event).pathname;
  if (!isPublicOpenApiPath(pathname) || isOpenApiEnabled()) {
    return;
  }

  setResponseStatus(event, 404);
  return createOpenApiDisabledBody();
});
