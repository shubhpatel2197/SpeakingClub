import * as React from 'react'
import { Box, Button, Stack, Typography, CircularProgress } from '@mui/material'
import { useAuthContext } from '../context/AuthProvider'
import AddGroupModal from '../components/groups/AddGroupModal'
import GroupCard from '../components/groups/GroupCard'
import { useGroups, Group } from '../hooks/useGroups'

export default function Home() {
  const { user } = useAuthContext()
  const [open, setOpen] = React.useState(false)

  const { groups, loading, error, refresh, loadMore, hasMore } = useGroups()

  console.log('Groups:', groups)

  const handleOpen = () => setOpen(true)

  // called when AddGroupModal successfully creates a group
  const handleClose = async () => {
    await refresh()
    setOpen(false)
  }

  // passed to GroupCard so it can refresh parent list after join
  const onJoinSuccess = async (groupId: string) => {
    await refresh()
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', py: 2 }}>
        
        <Button variant="contained" color="primary" onClick={handleOpen} sx={{ px: 3, borderRadius: 1 }}>
          Add Group
        </Button>
      </Box>

      <AddGroupModal open={open} handleClose={handleClose}/>

      <Box
        sx={{
          minHeight: '60vh',
          marginTop: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          width: '100%',
        }}
      >
        {loading && groups.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error">Failed to load groups</Typography>
        ) : groups.length === 0 ? (
          <Typography>No groups found. Create the first one!</Typography>
        ) : (
          <Stack direction="row" flexWrap="wrap" gap={3}>
            {groups.map((group: Group) => (
              <GroupCard key={group.id} group={group} onJoinSuccess={onJoinSuccess} />
            ))}
          </Stack>
        )}

        {hasMore && !loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button variant="outlined" onClick={() => loadMore()}>
              Load more
            </Button>
          </Box>
        )}

        {loading && groups.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Box>
    </>
  )
}
