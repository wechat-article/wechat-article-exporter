// 判断 URL 是否合法
export function urlIsValid(url: string): boolean {
  try {
    return new URL(url).toString().replace(/\/$/g, '') === url.replace(/\/$/g, '');
  } catch (e) {
    return false;
  }
}

// 判断 email 是否合法
export function emailIsValid(email: string): boolean {
  // RFC2822 Email Validation, come from https://regexr.com/2rhq7
  const emailRe =
    /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

  try {
    return emailRe.test(email);
  } catch (e) {
    return false;
  }
}
