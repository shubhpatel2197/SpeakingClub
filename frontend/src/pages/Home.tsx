import * as React from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
  Container,
  Fab,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useAuthContext } from '../context/AuthProvider';
import AddGroupModal from '../components/groups/AddGroupModal';
import GroupCard from '../components/groups/GroupCard';
import { useGroups } from '../context/GroupContext';

export default function Home() {
  const { user } = useAuthContext();
  const { groups, loading, refresh } = useGroups();
  const [open, setOpen] = React.useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTabletUp = useMediaQuery(theme.breakpoints.up('sm'));

  const handleOpen = () => setOpen(true);
  const handleClose = async () => {
    setOpen(false);
    await refresh();
  };
  const handleJoinOrLeave = async () => {
    await refresh();
  };

  const renderContent = () => {
    if (loading && groups.length === 0) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (groups.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ mb: 2 }}>
            No groups yet. Create the first one!
          </Typography>
          {isMobile && (
            <Button variant="contained" onClick={handleOpen}>
              Add Group
            </Button>
          )}
        </Box>
      );
    }

    // Responsive CSS grid (1/2/3/4 columns)
    return (
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 2, sm: 3 },
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {groups.map((group) => (
          <Box key={group.id}>
            <GroupCard
              group={group}
              onJoinSuccess={handleJoinOrLeave}
              onLeaveSuccess={handleJoinOrLeave}
            />
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Container
      maxWidth="lg"
      sx={{
        px: { xs: 2, sm: 3, md: 4 },
        pt: { xs: 2, sm: 3 },
        pb: { xs: 8, sm: 4 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 2 }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: { xs: 2, sm: 3 } }}
      >
        {/* <Box>
          <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: 18, sm: 20 } }}>
            Groups
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Welcome{user?.name ? `, ${user.name}` : ''}.
          </Typography>
        </Box> */}

        {isTabletUp && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpen}
            sx={{ px: 3, borderRadius: 1, alignSelf: 'flex-start' }}
          >
            Add Group
          </Button>
        )}
      </Stack>

      <AddGroupModal open={open} handleClose={handleClose} />

      <Box sx={{ minHeight: '55vh' }}>{renderContent()}</Box>

      {loading && groups.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!isTabletUp && (
        <Fab
          color="primary"
          onClick={handleOpen}
          aria-label="add group"
          sx={{
            position: 'fixed',
            right: 16,
            bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
            zIndex: (t) => t.zIndex.fab,
          }}
        >
          <AddIcon />
        </Fab>
      )}
    </Container>
  );
}
