// eslint-disable-next-line consistent-return
const isBoolean = (type) => {
  if (typeof type === 'string') {
    const resp = type.trim().toLowerCase();
    return resp === 'true';
  }
  return Boolean(type);
};

exports.isBoolean = isBoolean;
