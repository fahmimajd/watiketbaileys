import React from "react";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles({
  title: {
    fontWeight: 700,
    letterSpacing: "-0.5px",
  },
});

export default function Title(props) {
  const classes = useStyles();
  return (
    <Typography variant="h5" color="primary" className={classes.title} gutterBottom>
      {props.children}
    </Typography>
  );
}
