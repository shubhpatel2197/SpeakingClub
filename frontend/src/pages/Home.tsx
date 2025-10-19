import * as React from 'react'
import { Box, Button, Stack, Typography, CircularProgress } from '@mui/material'
import { useAuthContext } from '../context/AuthProvider'
import AddGroupModal from '../components/groups/AddGroupModal'
import GroupCard from '../components/groups/GroupCard'
import { useGroups} from '../context/GroupContext'

export default function Home() {
  const { user } = useAuthContext()
  const { groups, loading, refresh } = useGroups();
  const [open, setOpen] = React.useState(false)
  console.log("Home component groups:", groups);

  const handleOpen = () => setOpen(true)
  const handleClose = async () => {
    setOpen(false)
    await refresh() // refresh after modal closes (new group created)
  }

  const handleJoinOrLeave = async () => {
    await refresh() // refresh list after joining/leaving
  }

  const renderContent = () => {
    if (loading && groups.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )
    }

    // if (error) {
    //   return (
    //     <Typography color="error" sx={{ textAlign: 'center', py: 4 }}>
    //       Failed to load groups
    //     </Typography>
    //   )
    // }

    if (groups.length === 0) {
      return (
        <Typography sx={{ textAlign: 'center', py: 4 }}>
          No groups found. Create the first one!
        </Typography>
      )
    }

    return (
      <Stack direction="row" flexWrap="wrap" gap={3} justifyContent="flex-start">
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            onJoinSuccess={handleJoinOrLeave}
            onLeaveSuccess={handleJoinOrLeave}
          />
        ))}
      </Stack>
    )
  }

  return (
    <Box sx={{ mx: '120px' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 2,
        }}
      >
        {/* <Typography variant="h5" fontWeight={600}>
          Groups
        </Typography> */}

        <Button
          variant="contained"
          color="primary"
          onClick={handleOpen}
          sx={{ px: 3, borderRadius: 1 }}
        >
          Add Group
        </Button>
      </Box>

      {/* Add Group Modal */}
      <AddGroupModal open={open} handleClose={handleClose} />

      {/* Groups List */}
      <Box sx={{ minHeight: '60vh', mt: 2 }}>{renderContent()}</Box>

      {/* Small loader when fetching updates */}
      {loading && groups.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  )
}
