import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import organizationService from '../services/organizationService';
import { useAuthStore } from '../stores/authStore';
import { Building2, Check, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const OrganizationSwitcher: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, setAuth } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch user's organizations
  const { data: userOrganizations = [], isLoading } = useQuery({
    queryKey: ['user-organizations'],
    queryFn: () => organizationService.getUserOrganizations(),
  });

  // Switch organization mutation
  const switchMutation = useMutation({
    mutationFn: (organizationId: string) => organizationService.switchOrganization(organizationId),
    onSuccess: async (data) => {
      // Update user's organizationId in auth store
      if (user) {
        const updatedUser = {
          ...user,
          organizationId: data.organizationId,
          organization: data.organization,
        };
        setAuth(updatedUser, localStorage.getItem('token') || '');
      }

      // Invalidate all queries to refetch data for new organization
      queryClient.invalidateQueries();

      toast.success(`Przełączono na: ${data.organization.name}`);
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas przełączania szkoły');
    },
  });

  const handleSwitch = (organizationId: string) => {
    if (organizationId !== user?.organizationId) {
      switchMutation.mutate(organizationId);
    } else {
      setIsOpen(false);
    }
  };

  // Find current organization
  const currentOrg = userOrganizations.find(
    (uo) => uo.organizationId === user?.organizationId
  );


  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
        disabled={isLoading || switchMutation.isPending}
      >
        <Building2 className="h-5 w-5 text-primary" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {currentOrg?.organization.name || 'Wybierz szkołę'}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Twoje szkoły
              </div>
              {userOrganizations.map((userOrg) => {
                const isActive = userOrg.organizationId === user?.organizationId;

                return (
                  <button
                    key={userOrg.id}
                    onClick={() => handleSwitch(userOrg.organizationId)}
                    disabled={switchMutation.isPending}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-100 text-gray-900'
                    } ${switchMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium">{userOrg.organization.name}</div>
                    </div>
                    {isActive && <Check className="h-5 w-5 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OrganizationSwitcher;
