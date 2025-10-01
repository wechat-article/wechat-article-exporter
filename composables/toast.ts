export default (icon = 'i-octicon:bell-24') => {
  const toast = useToast();

  function info(title: string, description: string = '') {
    toast.add({
      color: 'gray',
      title: title,
      description: description,
      icon: icon,
    });
  }
  function warning(title: string, description: string = '') {
    toast.add({
      color: 'orange',
      title: title,
      description: description,
      icon: icon,
    });
  }
  function success(title: string, description: string = '') {
    toast.add({
      color: 'sky',
      title: title,
      description: description,
      icon: icon,
    });
  }
  function error(title: string, description: string = '') {
    toast.add({
      color: 'rose',
      title: title,
      description: description,
      icon: icon,
    });
  }

  return {
    info,
    warning,
    success,
    error,
  };
};
