import React, { useState, useEffect } from "react";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Container from "@material-ui/core/Container";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		alignItems: "center",
		padding: theme.spacing(8, 8, 3),
	},

	paper: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		marginBottom: 12,

	},

	settingOption: {
		marginLeft: "auto",
	},
	margin: {
		margin: theme.spacing(1),
	},

}));

const Settings = () => {
	const classes = useStyles();

	const [settings, setSettings] = useState([]);

	useEffect(() => {
		const fetchSession = async () => {
			try {
				const { data } = await api.get("/settings");
				setSettings(data);
			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", data => {
			if (data.action === "update") {
				setSettings(prevState => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex(s => s.key === data.setting.key);
					aux[settingIndex].value = data.setting.value;
					return aux;
				});
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleChangeSetting = async e => {
		const selectedValue = e.target.value;
		const settingKey = e.target.name;

		try {
			await api.put(`/settings/${settingKey}`, {
				value: selectedValue,
			});
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const getSettingValue = key => {
    const setting = settings.find(s => s.key === key);
    return setting ? setting.value : "";
  };

	return (
		<div className={classes.root}>
			<Container className={classes.container} maxWidth="sm">
				<Typography variant="body2" gutterBottom>
					{i18n.t("settings.title")}
				</Typography>
				<Paper className={classes.paper}>
					<Typography variant="body1">
						{i18n.t("settings.settings.userCreation.name")}
					</Typography>
					<Select
						margin="dense"
						variant="outlined"
						native
						id="userCreation-setting"
						name="userCreation"
						value={
							settings && settings.length > 0 && getSettingValue("userCreation")
						}
						className={classes.settingOption}
						onChange={handleChangeSetting}
					>
						<option value="enabled">
							{i18n.t("settings.settings.userCreation.options.enabled")}
						</option>
						<option value="disabled">
							{i18n.t("settings.settings.userCreation.options.disabled")}
						</option>
					</Select>

				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="api-token-setting"
						readonly
						label="Token Api"
						margin="dense"
						variant="outlined"
						fullWidth
						value={settings && settings.length > 0 && getSettingValue("userApiToken")}
					/>
				</Paper>

				{/* Out-of-hours auto-reply settings */}
				<Paper className={classes.paper}>
					<Typography variant="body1">Out-of-hours Auto Reply</Typography>
					<Select
						margin="dense"
						variant="outlined"
						native
						id="outofhours-setting"
						name="outOfHours"
						value={settings && settings.length > 0 && getSettingValue("outOfHours")}
						className={classes.settingOption}
						onChange={handleChangeSetting}
					>
						<option value="enabled">Enabled</option>
						<option value="disabled">Disabled</option>
					</Select>
				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="outofhours-message"
						label="Out-of-hours Message"
						name="outOfHoursMessage"
						margin="dense"
						variant="outlined"
						fullWidth
						multiline
						rows={3}
						value={settings && settings.length > 0 && getSettingValue("outOfHoursMessage")}
						onChange={handleChangeSetting}
					/>
				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="business-start"
						label="Business Hours Start (HH:mm)"
						name="businessHoursStart"
						margin="dense"
						variant="outlined"
						className={classes.margin}
						value={settings && settings.length > 0 && getSettingValue("businessHoursStart")}
						onChange={handleChangeSetting}
					/>
					<TextField
						id="business-end"
						label="Business Hours End (HH:mm)"
						name="businessHoursEnd"
						margin="dense"
						variant="outlined"
						className={classes.margin}
						value={settings && settings.length > 0 && getSettingValue("businessHoursEnd")}
						onChange={handleChangeSetting}
					/>
				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="business-days"
						label="Business Days (0=Sun,..,6=Sat)"
						name="businessDays"
						margin="dense"
						variant="outlined"
						fullWidth
						helperText="Comma-separated, e.g. 1,2,3,4,5 for Mon–Fri"
						value={settings && settings.length > 0 && getSettingValue("businessDays")}
						onChange={handleChangeSetting}
					/>
				</Paper>

				<Paper className={classes.paper}>
					<TextField
						id="business-tz"
						label="Business TZ Offset (minutes)"
						name="businessTzOffsetMin"
						margin="dense"
						variant="outlined"
						fullWidth
						helperText="e.g., 420 for UTC+7; -60 for UTC-1"
						value={settings && settings.length > 0 && getSettingValue("businessTzOffsetMin")}
						onChange={handleChangeSetting}
					/>
				</Paper>

			</Container>
		</div>
	);
};

export default Settings;
