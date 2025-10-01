/**
 * 内测用户 (fakeid)
 */
const insider_users: string[] = ['板板0305', '七嘻瞎毕里', '软妹聊技术', '踏浪方程式'];

const loginAccount = useLoginAccount();

export const isInsider = computed(() => insider_users.includes(loginAccount.value?.nickname));
