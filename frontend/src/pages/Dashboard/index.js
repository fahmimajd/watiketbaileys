import React, { useContext } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { id as idLocale } from "date-fns/locale"

import Paper from "@material-ui/core/Paper"
import Container from "@material-ui/core/Container"
import Grid from "@material-ui/core/Grid"
import { makeStyles } from "@material-ui/core/styles"
import Typography from "@material-ui/core/Typography"
import Table from "@material-ui/core/Table"
import TableBody from "@material-ui/core/TableBody"
import TableCell from "@material-ui/core/TableCell"
import TableHead from "@material-ui/core/TableHead"
import TableRow from "@material-ui/core/TableRow"
import Avatar from "@material-ui/core/Avatar"
import Chip from "@material-ui/core/Chip"
import Skeleton from "@material-ui/lab/Skeleton"
import PeopleAltIcon from "@material-ui/icons/PeopleAlt"
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty"
import CheckCircleIcon from "@material-ui/icons/CheckCircle"
import PersonIcon from "@material-ui/icons/Person"

import useTickets from "../../hooks/useTickets"
import useDashboardMetrics from "../../hooks/useDashboardMetrics"

import { AuthContext } from "../../context/Auth/AuthContext"

import { i18n } from "../../translate/i18n"

import Chart from "./Chart"

const useStyles = makeStyles(theme => ({
	container: {
		paddingTop: theme.spacing(4),
		paddingBottom: theme.spacing(4),
	},
	fixedHeightPaper: {
		padding: theme.spacing(2),
		display: "flex",
		overflow: "auto",
		flexDirection: "column",
		height: 240,
	},
	customFixedHeightPaper: {
		padding: theme.spacing(3),
		display: "flex",
		overflow: "hidden",
		flexDirection: "column",
		height: 120,
		position: "relative",
		transition: "transform 0.2s, box-shadow 0.2s",
		"&:hover": {
			transform: "translateY(-2px)",
			boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
		},
	},
	customFixedHeightPaperLg: {
		padding: theme.spacing(2),
		display: "flex",
		overflow: "auto",
		flexDirection: "column",
		height: "100%",
	},
	statIcon: {
		position: "absolute",
		right: 20,
		top: 20,
		opacity: 0.15,
		fontSize: 48,
	},
	statNumber: {
		fontWeight: 700,
		fontSize: "2.5rem",
	},
	operatorSection: {
		marginTop: theme.spacing(4),
	},
	operatorTableHeader: {
		backgroundColor: theme.palette.mode === "dark" ? "#334155" : "#f8fafc",
	},
	operatorNameCell: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
	},
	operatorAvatar: {
		width: 36,
		height: 36,
		backgroundColor: theme.palette.primary.main,
		color: "#fff",
		fontWeight: 600,
		fontSize: 14,
	},
	chipOpen: {
		backgroundColor: "#dcfce7",
		color: "#166534",
		fontWeight: 600,
		fontSize: 12,
	},
	chipPending: {
		backgroundColor: "#fef3c7",
		color: "#92400e",
		fontWeight: 600,
		fontSize: 12,
	},
	chipClosed: {
		backgroundColor: "#e2e8f0",
		color: "#475569",
		fontWeight: 600,
		fontSize: 12,
	},
	lastActiveText: {
		fontSize: 12,
		color: theme.palette.text.secondary,
	},
}))

const formatLastActive = (date) => {
	if (!date) return "—"
	const d = new Date(date)
	if (isNaN(d.getTime())) return "—"
	const now = new Date()
	const diffMs = now - d
	const diffHours = diffMs / (1000 * 60 * 60)
	if (diffHours < 1) {
		return formatDistanceToNow(d, { addSuffix: true, locale: idLocale })
	}
	if (diffHours < 24) {
		return formatDistanceToNow(d, { addSuffix: true, locale: idLocale })
	}
	return format(d, "dd MMM HH:mm", { locale: idLocale })
}

const Dashboard = () => {
	const classes = useStyles()

	const { user } = useContext(AuthContext)
	var userQueueIds = []

	if (user.queues && user.queues.length > 0) {
		userQueueIds = user.queues.map(q => q.id)
	}

	const GetTickets = (status, showAll, withUnreadMessages) => {
		const { count } = useTickets({
			status: status,
			showAll: showAll,
			withUnreadMessages: withUnreadMessages,
			queueIds: JSON.stringify(userQueueIds)
		})
		return count
	}

	const { operators, loading: metricsLoading } = useDashboardMetrics()

	return (
		<div>
			<Container maxWidth="lg" className={classes.container}>
				<Grid container spacing={3}>
					<Grid item xs={4}>
						<Paper className={classes.customFixedHeightPaper} style={{ overflow: "hidden", borderLeft: "4px solid #6366f1" }}>
							<PeopleAltIcon className={classes.statIcon} style={{ color: "#6366f1" }} />
							<Typography component="h3" variant="h6" color="primary" paragraph>
								{i18n.t("dashboard.messages.inAttendance.title")}
							</Typography>
							<Grid item>
								<Typography component="h1" variant="h4" className={classes.statNumber}>
									{GetTickets("open", "true", "false")}
								</Typography>
							</Grid>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper className={classes.customFixedHeightPaper} style={{ overflow: "hidden", borderLeft: "4px solid #f59e0b" }}>
							<HourglassEmptyIcon className={classes.statIcon} style={{ color: "#f59e0b" }} />
							<Typography component="h3" variant="h6" color="primary" paragraph>
								{i18n.t("dashboard.messages.waiting.title")}
							</Typography>
							<Grid item>
								<Typography component="h1" variant="h4" className={classes.statNumber}>
									{GetTickets("pending", "true", "false")}
								</Typography>
							</Grid>
						</Paper>
					</Grid>
					<Grid item xs={4}>
						<Paper className={classes.customFixedHeightPaper} style={{ overflow: "hidden", borderLeft: "4px solid #22c55e" }}>
							<CheckCircleIcon className={classes.statIcon} style={{ color: "#22c55e" }} />
							<Typography component="h3" variant="h6" color="primary" paragraph>
								{i18n.t("dashboard.messages.closed.title")}
							</Typography>
							<Grid item>
								<Typography component="h1" variant="h4" className={classes.statNumber}>
									{GetTickets("closed", "true", "false")}
								</Typography>
							</Grid>
						</Paper>
					</Grid>
					<Grid item xs={12}>
						<Paper className={classes.fixedHeightPaper}>
							<Chart />
						</Paper>
					</Grid>
				</Grid>

				<div className={classes.operatorSection}>
					<Typography variant="h6" color="primary" gutterBottom style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
						<PersonIcon />
						Laporan Operator
					</Typography>
					<Paper style={{ overflowX: "auto" }}>
						<Table size="small">
							<TableHead>
								<TableRow className={classes.operatorTableHeader}>
									<TableCell><strong>Operator</strong></TableCell>
									<TableCell align="center"><strong>Sedang Ditangani</strong></TableCell>
									<TableCell align="center"><strong>Menunggu</strong></TableCell>
									<TableCell align="center"><strong>Selesai</strong></TableCell>
									<TableCell align="center"><strong>Total</strong></TableCell>
									<TableCell align="center"><strong>Last Active</strong></TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{metricsLoading
									? Array.from({ length: 3 }).map((_, i) => (
											<TableRow key={i}>
												<TableCell><Skeleton width={120} /></TableCell>
												<TableCell align="center"><Skeleton width={30} /></TableCell>
												<TableCell align="center"><Skeleton width={30} /></TableCell>
												<TableCell align="center"><Skeleton width={30} /></TableCell>
												<TableCell align="center"><Skeleton width={30} /></TableCell>
												<TableCell align="center"><Skeleton width={80} /></TableCell>
											</TableRow>
									  ))
									: operators.map(op => (
											<TableRow key={op.id} hover>
												<TableCell>
													<div className={classes.operatorNameCell}>
														<Avatar className={classes.operatorAvatar}>
															{op.name.charAt(0).toUpperCase()}
														</Avatar>
														<div>
															<Typography variant="body2" style={{ fontWeight: 600 }}>{op.name}</Typography>
															<Typography variant="caption" color="textSecondary">{op.email}</Typography>
														</div>
													</div>
												</TableCell>
												<TableCell align="center">
													{op.openTickets > 0 ? (
														<Chip label={op.openTickets} size="small" className={classes.chipOpen} />
													) : (
														<Typography variant="body2" color="textSecondary">0</Typography>
													)}
												</TableCell>
												<TableCell align="center">
													{op.pendingTickets > 0 ? (
														<Chip label={op.pendingTickets} size="small" className={classes.chipPending} />
													) : (
														<Typography variant="body2" color="textSecondary">0</Typography>
													)}
												</TableCell>
												<TableCell align="center">
													{op.closedTickets > 0 ? (
														<Chip label={op.closedTickets} size="small" className={classes.chipClosed} />
													) : (
														<Typography variant="body2" color="textSecondary">0</Typography>
													)}
												</TableCell>
												<TableCell align="center">
													<Typography variant="body2" style={{ fontWeight: 600 }}>{op.totalTickets}</Typography>
												</TableCell>
												<TableCell align="center">
													<Typography className={classes.lastActiveText}>
														{formatLastActive(op.lastActive || op.lastMessageAt)}
													</Typography>
												</TableCell>
											</TableRow>
									  ))}
							</TableBody>
						</Table>
					</Paper>
				</div>
			</Container>
		</div>
	)
}

export default Dashboard
