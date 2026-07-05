export default () => {
  const toast = useToast();

  function success(title: string, description: string = '') {
    toast.add({
      color: 'sky',
      title: title,
      description: description,
      icon: 'i-heroicons-sparkles-20-solid',
      timeout: 5000,
    });
  }
  function info(title: string, description: string = '') {
    toast.add({
      color: 'gray',
      title: title,
      description: description,
      icon: 'i-heroicons-bell-alert-20-solid',
      timeout: 5000,
    });
  }
  function warning(title: string, description: string = '') {
    toast.add({
      color: 'orange',
      title: title,
      description: description,
      icon: 'i-heroicons-exclamation-triangle-20-solid',
      timeout: 5000,
    });
  }
  function error(title: string, description: string = '') {
    toast.add({
      color: 'rose',
      title: title,
      description: description,
      icon: 'i-heroicons-x-circle-20-solid',
      timeout: 5000,
    });
  }

  return {
    info,
    warning,
    success,
    error,
  };
};
