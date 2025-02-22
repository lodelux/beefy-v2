export const styles = theme => ({
  select: {
    '& .MuiSelect-select': {
      color: theme.palette.text.disabled,
      fontWeight: 700,
      fontSize: 15,
      padding: '0px 30px 0px 0px',
      border: props =>
        props.noBorder
          ? 'none'
          : theme.palette.type === 'dark'
          ? '2px solid #313759'
          : '2px solid #ff0000',
      borderRadius: '8px',
      height: '36px',
      textAlign: 'right',
      display: 'flex',
      alignItems: 'center',
      '& img': {
        height: '18px',
        marginRight: '5px',
      },
    },
    '& .MuiSelect-icon': {
      color: theme.palette.text.disabled,
      right: '8px',
    },
    '& .MuiTypography-root': {
      color: theme.palette.text.disabled,
    },
    '&:hover': {
      borderColor: theme.palette.type === 'dark' ? '#3F466D' : '#ff0000',
    },
    '&:hover .MuiSelect-select': {
      color: theme.palette.type === 'dark' ? '#8585A6' : '#ff0000',
    },
  },
  selectList: {
    color: theme.palette.type === 'dark' ? '#6B7199' : '#ff0000',
    border: theme.palette.type === 'dark' ? '2px solid #313759' : '2px solid #6B7199',
    backgroundColor: theme.palette.type === 'dark' ? '#1B203A' : '#faf6f1',
    padding: '0px',
    margin: '0px',
    '& img': {
      height: '24px',
      marginRight: '5px',
    },
    '& .MuiListItem-gutters': {
      padding: '0px 4px',
    },
  },
  placeholder: {
    '&.Mui-disabled': {
      color: theme.palette.type === 'dark' ? 'white' : 'black',
    },
  },
});
